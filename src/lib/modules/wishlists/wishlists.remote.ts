import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { isAppAdmin } from '$lib/server/admin.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistVisit } from '$lib/server/db/wishlist_visit.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import {
	guardedCommand,
	guardedQuery,
	publicQuery,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { resolveRevertAccess } from '$lib/server/operations/wishlist_revert.js';
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
import { resolveWishlistRole } from './wishlist_access.js';
import { resolveReservationReleaseCapability } from './wishlist_capabilities.js';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	RenameRecipientInputSchema,
	FlipRecipientToFreeTextInputSchema,
	SetWishlistPaletteInputSchema,
	type WishlistRole,
} from './types.js';
import {
	createOwnRolePrimitives,
	createModeratedRolePrimitives,
	createFollowedRolePrimitives,
	recipientDisplayNameSql,
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

export const getWishlistByShortId = publicQuery(v.string(), async (authContext, shortId) => {
	const database = getDb();

	const rows = await database
		.select({
			wishlist: wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			// Raw persisted value (Google profile picture URL or uploaded object key, issue #158) –
			// null for a free-text (for-someone-else) recipient, same as recipientDisplayName's name.
			recipientImage: user.image,
		})
		.from(wishlist)
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}

	// Determine role
	const role: WishlistRole = await resolveWishlistRole(authContext, row.wishlist);

	// Manager names power the header „Spravuje/Spravují {names}" meta row — fetched for ALL
	// lists, self lists included (2026-07-14 header decision). A self-promoted linked
	// recipient counts as a správce in this line even though they have no
	// moderator_assignment row (`recipientIsModerator` flag).
	const managerRows = await database
		.select({ name: user.name })
		.from(moderatorAssignment)
		.innerJoin(user, eq(moderatorAssignment.userId, user.id))
		.where(
			and(
				eq(moderatorAssignment.wishlistId, row.wishlist.id),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.orderBy(moderatorAssignment.assignedAt);
	const managerNames = managerRows.map((manager) => manager.name);
	if (row.wishlist.recipientUserId !== null && row.wishlist.recipientIsModerator) {
		managerNames.unshift(row.recipientDisplayName);
	}

	// Revert-to-draft affordance for THIS viewer (issue #150). Server-computed so the client
	// (settings gear + danger tab) renders the exact variant without any admin logic of its own.
	// The reservation count is consulted only for a manager/admin on an active list.
	const isAdmin = isAppAdmin(authContext?.user.email);
	const { capability: revertCapability } = await resolveRevertAccess(database, {
		role,
		wishlistRow: row.wishlist,
		isAppAdministrator: isAdmin,
	});
	// How far this viewer's reservation-release reach extends (issue #213, REQ-7). Reuses the
	// `isAdmin`/`role` already resolved above, so it costs no extra query; the administrator
	// identity itself (`ADMIN_EMAILS`) never leaves the server.
	const reservationReleaseCapability = resolveReservationReleaseCapability({ role, isAdmin });

	return {
		...row.wishlist,
		recipientDisplayName: row.recipientDisplayName,
		// The recipient's avatar (issue #158). The wishlist header already shows this same
		// recipient's name to every visitor of this public query, so surfacing their avatar
		// picture alongside it exposes no new PII beyond what this surface already reveals.
		recipientImage: resolveUserImageUrl(row.recipientImage),
		managerNames,
		role,
		revertCapability,
		reservationReleaseCapability,
	} as const;
});

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

// ── Follower Commands ──────────────────────────────────────────────────────

export const followWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Verify wishlist exists
	const wishlistRows = await database
		.select({ recipientUserId: wishlist.recipientUserId })
		.from(wishlist)
		// fallow-ignore-next-line code-duplication
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, 'Wishlist not found');
	}

	// The linked recipient never follows their own list (it lives in Moje seznamy).
	if (wishlistRow.recipientUserId === user.id) {
		return { followed: false, alreadyFollowing: false };
	}

	// Check if already following
	const existingRows = await database
		.select()
		.from(wishlistFollower)
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		)
		.limit(1);

	const existing = existingRows[0];

	if (existing !== undefined) {
		// Update last visited timestamp
		await database
			.update(wishlistFollower)
			.set({ lastVisitedAt: new Date() })
			.where(
				and(
					eq(wishlistFollower.wishlistId, wishlistId),
					eq(wishlistFollower.userId, user.id),
				),
			);
		return { followed: false, alreadyFollowing: existing.unfollowedAt === null };
	}

	// Create new follower record
	await database.insert(wishlistFollower).values({
		wishlistId,
		userId: user.id,
		lastVisitedAt: new Date(),
	});

	return { followed: true, alreadyFollowing: false };
});

export const unfollowWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	await database
		.update(wishlistFollower)
		.set({ unfollowedAt: new Date() })
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		);

	// Single-flight refresh (issue #108, REQ-3/4): the Sledované page tracks this
	// query, so the updated follow state rides back on the command response.
	singleFlightRefresh(getFollowedWishlists);
});

export const refollowWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	await database
		.update(wishlistFollower)
		.set({ unfollowedAt: null, lastVisitedAt: new Date() })
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		);

	// Single-flight refresh (issue #108, REQ-3/4): see unfollowWishlist.
	singleFlightRefresh(getFollowedWishlists);
});

/**
 * Record that the caller opened /w/<id> (issue #225). Fires once per view for ANY authed
 * user and folds in the legacy auto-follow: it upserts a `wishlist_visit` row for everyone
 * (owner, moderator, follower, first-time visitor) so the „Nedávné" row has recency, then
 * auto-follows ONLY non-managers — the linked recipient never gains a follower row, and a
 * moderator records a visit without becoming a redundant follower.
 *
 * Deliberately does NOT single-flight-refresh any dashboard query: a plain visit must not
 * trigger list refetches (request budget, issue #108).
 */
export const recordWishlistVisit = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	const wishlistRows = await database
		.select({ recipientUserId: wishlist.recipientUserId })
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, 'Wishlist not found');
	}

	// Upsert the visit for every authed viewer — this is what powers Nedávné recency.
	await database
		.insert(wishlistVisit)
		.values({ userId: user.id, wishlistId, lastVisitedAt: new Date() })
		.onConflictDoUpdate({
			target: [wishlistVisit.userId, wishlistVisit.wishlistId],
			set: { lastVisitedAt: new Date() },
		});

	// The linked recipient manages inherently and never follows their own list.
	if (wishlistRow.recipientUserId === user.id) {
		return;
	}

	// A moderator (správce) records the visit above but must not be auto-followed.
	const moderatorRows = await database
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, user.id),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);
	if (moderatorRows[0] !== undefined) {
		return;
	}

	// Auto-follow the visitor so the shared list surfaces in „Sledované". An existing follower
	// row (even a previously unfollowed one) is left as-is — recency lives in wishlist_visit now.
	const existingFollower = await database
		.select({ unfollowedAt: wishlistFollower.unfollowedAt })
		.from(wishlistFollower)
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		)
		.limit(1);
	if (existingFollower[0] === undefined) {
		await database.insert(wishlistFollower).values({
			wishlistId,
			userId: user.id,
			lastVisitedAt: new Date(),
		});
	}
});
