import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import {
	guardedCommand,
	guardedQuery,
	publicQuery,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import {
	createWishlistOperation,
	renameRecipientOperation,
	setWishlistPaletteOperation,
	updateWishlistOperation,
} from '$lib/server/operations/wishlist_detail_operations.js';
import {
	archiveWishlistOperation,
	deleteWishlistOperation,
	flipRecipientToFreeTextOperation,
} from '$lib/server/operations/wishlist_lifecycle_operations.js';
import { readWishlistOperation } from '$lib/server/operations/wishlist_read_operations.js';
import {
	followWishlistOperation,
	recordWishlistVisitOperation,
	refollowWishlistOperation,
	unfollowWishlistOperation,
} from '$lib/server/operations/wishlist_follow_operations.js';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	RenameRecipientInputSchema,
	FlipRecipientToFreeTextInputSchema,
	SetWishlistPaletteInputSchema,
} from './types.js';
import {
	createOwnRolePrimitives,
	createModeratedRolePrimitives,
	createFollowedRolePrimitives,
} from './wishlist_role_query_primitives.js';

// ── Queries ──────────────────────────────────────────────────────────────────

export const getMyWishlists = guardedQuery(async ({ user }) => {
	const database = getDb();
	const ownRole = createOwnRolePrimitives(database, user.id);
	const rows = await database
		.select(ownRole.projection)
		.from(wishlist)
		.leftJoin(ownRole.totalGifts, eq(ownRole.totalGifts.wishlistId, wishlist.id))
		.where(and(ownRole.predicate, isNull(wishlist.deletedAt), wishlistScope()))
		.orderBy(wishlist.updatedAt);
	return rows.map(ownRole.map);
});

export const getWishlistByShortId = publicQuery(v.string(), (authContext, shortId) =>
	executeOperation(
		authContext === null ? null : userInterfaceActor(authContext.user),
		readWishlistOperation,
		{ wishlistShortId: shortId },
	),
);

export const getModeratedWishlists = guardedQuery(async ({ user: currentUser }) => {
	const database = getDb();
	const role = createModeratedRolePrimitives(database, currentUser.id);
	const rows = await database
		.select(role.projection)
		.from(moderatorAssignment)
		.innerJoin(wishlist, eq(moderatorAssignment.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(role.totalGifts, eq(role.totalGifts.wishlistId, wishlist.id))
		.leftJoin(role.reservedGifts, eq(role.reservedGifts.wishlistId, wishlist.id))
		.where(and(role.predicate, isNull(wishlist.deletedAt), wishlistScope()))
		.orderBy(wishlist.updatedAt);
	return rows.map(role.map);
});

export const getFollowedWishlists = guardedQuery(async ({ user: currentUser }) => {
	const database = getDb();
	const role = createFollowedRolePrimitives(database, currentUser.id);
	const rows = await database
		.select(role.projection)
		.from(wishlistFollower)
		.innerJoin(wishlist, eq(wishlistFollower.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(role.availableGifts, eq(role.availableGifts.wishlistId, wishlist.id))
		.leftJoin(role.myReservations, eq(role.myReservations.wishlistId, wishlist.id))
		// Dashboard history deliberately includes unfollowed and archived rows.
		.where(and(role.predicate, isNull(wishlist.deletedAt), wishlistScope()))
		.orderBy(wishlist.updatedAt);
	return rows.map(role.map);
});

// ── Commands ─────────────────────────────────────────────────────────────────

export const createWishlist = guardedCommand(CreateWishlistInputSchema, async ({ user }, input) =>
	executeOperation(userInterfaceActor(user), createWishlistOperation, input),
);

export const updateWishlist = guardedCommand(UpdateWishlistInputSchema, async ({ user }, input) => {
	// The operation locks the wishlist, so cleanup after commit deletes exactly the banner it replaced.
	const { wishlist: updated, wishlistShortId } = await executeOperation(
		userInterfaceActor(user),
		updateWishlistOperation,
		input,
	);
	singleFlightRefresh(getWishlistByShortId, wishlistShortId);
	return updated;
});

/**
 * Rename a free-text recipient (issue #99). Any manager may do this anytime, incl. post-share.
 * Rejected on self/linked-recipient lists (there is no free-text name to rename) and on archived
 * lists. The for-me/for-someone kind itself is immutable — this only edits the display name.
 */
export const renameRecipient = guardedCommand(
	RenameRecipientInputSchema,
	async ({ user }, input) => {
		const { wishlist: updated, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			renameRecipientOperation,
			input,
		);
		// Single-flight refresh (issue #108, REQ-3/4): header/meta surfaces tracking the
		// wishlist query get the renamed recipient in the same round trip.
		singleFlightRefresh(getWishlistByShortId, wishlistShortId);
		return updated;
	},
);

/**
 * Flip a linked recipient to a free-text recipient (issue #150, decision 2026-07-14).
 * Only the LINKED RECIPIENT may convert their OWN list — správci cannot (no evicting a
 * linked recipient). The flip clears `recipientUserId`, sets the free-text name, resets
 * the self-promote disclosure flag (the trust banner disappears; the always-visible
 * „Spravuje {name}" line is the ongoing disclosure), and gives the ex-recipient an active
 * správce assignment (keeps management, satisfies the orphan guard). Shared lists notify
 * followers via the existing self-promote channel (email + in-app) that the actor now
 * sees reservations; drafts stay silent; archived lists are rejected. One-way: linking a
 * recipient back requires the claim link.
 */
export const flipRecipientToFreeText = guardedCommand(
	FlipRecipientToFreeTextInputSchema,
	async ({ user: currentUser }, input) => {
		const { wishlist: updated, wishlistShortId } = await executeOperation(
			userInterfaceActor(currentUser),
			flipRecipientToFreeTextOperation,
			input,
		);
		// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the new
		// role in the same round trip, and the list moves from "Moje seznamy" to "Spravované"
		// on both dashboards without a reload.
		singleFlightRefresh(getWishlistByShortId, wishlistShortId);
		singleFlightRefresh(getMyWishlists);
		singleFlightRefresh(getModeratedWishlists);
		return updated;
	},
);

/**
 * Change a wishlist's palette (per-list visual identity, Redesign 2026 issue #102).
 * Any manager (recipient or správce) may change it; archived lists are read-only,
 * matching the updateWishlist theme rules.
 */
export const setWishlistPalette = guardedCommand(
	SetWishlistPaletteInputSchema,
	async ({ user }, input) => {
		const { wishlist: updated, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			setWishlistPaletteOperation,
			input,
		);
		// Single-flight refresh (issue #108, REQ-3/4): only the open wishlist page query
		// rides back. Dashboards and nav dropdowns are NOT refreshed per mutation — those
		// surfaces re-fetch when they are actually opened, so refreshing them here only
		// burned three list queries per palette change.
		singleFlightRefresh(getWishlistByShortId, wishlistShortId);
		return updated;
	},
);

export const archiveWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	// Any manager (recipient or správce) may archive.
	const { wishlist: archived, wishlistShortId } = await executeOperation(
		userInterfaceActor(user),
		archiveWishlistOperation,
		{ wishlistId },
	);
	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
	// archived status in the same round trip.
	singleFlightRefresh(getWishlistByShortId, wishlistShortId);
	return archived;
});

export const deleteWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	// Any manager (recipient or správce) may delete an unshared list.
	await executeOperation(userInterfaceActor(user), deleteWishlistOperation, { wishlistId });
	// Single-flight refresh (issue #108, REQ-3/4): the deleted list disappears from
	// whichever dashboard held it (recipient's "Moje seznamy" or a správce's
	// "Spravované") without a reload. Untracked queries are a no-op.
	singleFlightRefresh(getMyWishlists);
	singleFlightRefresh(getModeratedWishlists);
});

/**
 * Deletes a list only while it has no gifts (issue #557): a bulk copy whose response was lost may
 * still have committed into it. Returns whether the list was deleted.
 */
export const deleteWishlistIfEmpty = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const { deleted } = await executeOperation(userInterfaceActor(user), deleteWishlistOperation, {
		wishlistId,
		onlyIfEmpty: true,
	});
	singleFlightRefresh(getMyWishlists);
	singleFlightRefresh(getModeratedWishlists);
	return deleted;
});

// ── Follower Commands ──────────────────────────────────────────────────────

export const followWishlist = guardedCommand(v.string(), ({ user }, wishlistId) =>
	executeOperation(userInterfaceActor(user), followWishlistOperation, { wishlistId }),
);

export const unfollowWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	await executeOperation(userInterfaceActor(user), unfollowWishlistOperation, { wishlistId });
	// Single-flight refresh (issue #108, REQ-3/4): the Sledované page tracks this
	// query, so the updated follow state rides back on the command response.
	singleFlightRefresh(getFollowedWishlists);
});

export const refollowWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	await executeOperation(userInterfaceActor(user), refollowWishlistOperation, { wishlistId });
	// Single-flight refresh (issue #108, REQ-3/4): see unfollowWishlist.
	singleFlightRefresh(getFollowedWishlists);
});

/**
 * Record that the caller opened /w/<id> (issue #225): Nedávné recency for every signed-in
 * viewer plus the auto-follow of non-managers.
 *
 * Deliberately does NOT single-flight-refresh any dashboard query: a plain visit must not
 * trigger list refetches (request budget, issue #108).
 */
export const recordWishlistVisit = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	await executeOperation(userInterfaceActor(user), recordWishlistVisitOperation, { wishlistId });
});
