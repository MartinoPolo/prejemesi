import * as v from 'valibot';
import { eq, and, isNull, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { isAppAdmin } from '$lib/server/admin.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistVisit } from '$lib/server/db/wishlist_visit.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { resolveUserImageUrl } from '$lib/modules/images/public_url.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	guardedCommand,
	guardedQuery,
	publicQuery,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { isWithinGraceWindow } from '$lib/modules/sharing/grace_window.js';
import { seedNewWishlist } from './wishlist_create.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import {
	resolveWishlistRole,
	verifyManagerAccess,
	verifyLinkedRecipientAccess,
	assertWishlistMutable,
} from './wishlist_access.js';
import {
	resolveRevertCapability,
	resolveReservationReleaseCapability,
} from './wishlist_capabilities.js';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	RenameRecipientInputSchema,
	FlipRecipientToFreeTextInputSchema,
	SetWishlistPaletteInputSchema,
	WISHLIST_ROLES,
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
		.where(and(ownRole.predicate, isNull(wishlist.deletedAt)))
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
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
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
	const needsReservationCheck =
		row.wishlist.status === 'active' &&
		role !== WISHLIST_ROLES.recipient &&
		(role === WISHLIST_ROLES.moderator || isAdmin);
	let hasReservations = false;
	if (needsReservationCheck) {
		const reservationCountRows = await database
			.select({ value: count() })
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.where(
				and(
					eq(gift.wishlistId, row.wishlist.id),
					isNull(reservation.deletedAt),
					isNull(gift.deletedAt),
				),
			);
		hasReservations = (reservationCountRows[0]?.value ?? 0) > 0;
	}
	const revertCapability = resolveRevertCapability({
		role,
		status: row.wishlist.status,
		isAdmin,
		hasReservations,
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
		.where(and(role.predicate, isNull(wishlist.deletedAt)))
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
		.where(and(role.predicate, isNull(wishlist.deletedAt)))
		.orderBy(wishlist.updatedAt);
	return rows.map(role.map);
});

// ── Commands ─────────────────────────────────────────────────────────────────

export const createWishlist = guardedCommand(CreateWishlistInputSchema, async ({ user }, input) => {
	const database = getDb();
	return database.transaction((tx) => seedNewWishlist(tx, user.id, input));
});

async function updateLockedWishlist(
	tx: GiftCreationTransaction,
	userId: string,
	input: v.InferOutput<typeof UpdateWishlistInputSchema>,
) {
	const rows = await tx
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, input.id), isNull(wishlist.deletedAt)))
		.limit(1)
		.for('update');
	const row = rows[0];
	if (row === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	if (row.recipientUserId !== userId) {
		const managers = await tx
			.select({ id: moderatorAssignment.id })
			.from(moderatorAssignment)
			.where(
				and(
					eq(moderatorAssignment.wishlistId, row.id),
					eq(moderatorAssignment.userId, userId),
					isNull(moderatorAssignment.deletedAt),
				),
			)
			.limit(1);
		if (managers[0] === undefined) {
			error(403, SERVER_ERROR.ACCESS_DENIED);
		}
	}
	if (row.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}

	const now = new Date();
	const isShared = row.sharedAt !== null;
	const updateData: Record<string, unknown> = { updatedAt: now };
	if (input.title !== undefined) {
		updateData['title'] = input.title;
	}
	if (input.description !== undefined) {
		updateData['description'] = input.description;
	}

	const eventDateGraceOpen =
		isShared && isWithinGraceWindow(row.eventDateEditedAt ?? row.sharedAt, now);
	if (input.eventDate !== undefined && (!isShared || eventDateGraceOpen)) {
		updateData['eventDate'] = input.eventDate;
		if (isShared) {
			updateData['eventDateEditedAt'] = now;
		}
	}

	if (
		input.imageKey !== undefined &&
		input.imageKey !== null &&
		input.imageKey !== row.imageKey
	) {
		const { assertWishlistBannerAssignment } = await import('./wishlist_image_assignment.js');
		await assertWishlistBannerAssignment(userId, input.imageKey, input.imageAssignmentToken);
	}
	if (input.imageKey !== undefined) {
		updateData['imageKey'] = input.imageKey;
	}
	if (input.imageSlots !== undefined) {
		updateData['imageSlots'] = input.imageSlots;
	}

	const [updated] = await tx
		.update(wishlist)
		.set(updateData)
		.where(eq(wishlist.id, input.id))
		.returning();
	return {
		updated,
		shortId: row.shortId,
		replacedImageKey:
			input.imageKey !== undefined && row.imageKey !== input.imageKey ? row.imageKey : null,
	};
}

export const updateWishlist = guardedCommand(UpdateWishlistInputSchema, async ({ user }, input) => {
	const database = getDb();
	// Lock/read/update form one serialization point. Cleanup uses the key this transaction
	// actually replaced, never a stale pre-transaction read from a competing image save.
	const result = await database.transaction((tx) => updateLockedWishlist(tx, user.id, input));
	if (result.replacedImageKey !== null) {
		await deleteObjectsBestEffort([result.replacedImageKey]);
	}
	singleFlightRefresh(getWishlistByShortId, result.shortId);
	return result.updated;
});

/**
 * Rename a free-text recipient (issue #99). Any manager may do this anytime, incl. post-share.
 * Rejected on self/linked-recipient lists (there is no free-text name to rename) and on archived
 * lists. The for-me/for-someone kind itself is immutable — this only edits the display name.
 */
export const renameRecipient = guardedCommand(
	RenameRecipientInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		const { wishlistRow } = await verifyManagerAccess(user.id, input.id);
		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
		}
		if (wishlistRow.recipientUserId !== null) {
			error(400, SERVER_ERROR.RECIPIENT_RENAME_NOT_ALLOWED);
		}

		const [updated] = await database
			.update(wishlist)
			.set({ recipientName: input.recipientName, updatedAt: new Date() })
			.where(eq(wishlist.id, input.id))
			.returning();

		// Single-flight refresh (issue #108, REQ-3/4): header/meta surfaces tracking the
		// wishlist query get the renamed recipient in the same round trip.
		singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

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
		const database = getDb();

		const wishlistRow = await verifyLinkedRecipientAccess(currentUser.id, input.id);
		assertWishlistMutable(wishlistRow);

		const updated = await database.transaction(async (tx) => {
			const [row] = await tx
				.update(wishlist)
				.set({
					recipientUserId: null,
					recipientName: input.recipientName,
					recipientIsModerator: false,
					updatedAt: new Date(),
				})
				.where(eq(wishlist.id, input.id))
				.returning();

			// The ex-recipient keeps managing as a regular správce with normal správce
			// visibility. A linked recipient can never already hold an active assignment
			// (acceptModeratorInvite rejects the recipient), so a plain insert is safe.
			await tx.insert(moderatorAssignment).values({
				wishlistId: input.id,
				userId: currentUser.id,
			});

			return row;
		});

		// Shared list: followers learn the actor now sees reservations — same channel and
		// copy as recipient self-promote. Draft: silent. Archived was rejected above.
		if (wishlistRow.sharedAt !== null) {
			const followerRows = await database
				.select({ userId: wishlistFollower.userId })
				.from(wishlistFollower)
				.where(
					and(
						eq(wishlistFollower.wishlistId, input.id),
						isNull(wishlistFollower.unfollowedAt),
					),
				);

			await dispatchNotification({
				type: NOTIFICATION_TYPE.RECIPIENT_SELF_PROMOTED,
				targetUserIds: followerRows
					.map((row) => row.userId)
					.filter((targetUserId) => targetUserId !== currentUser.id),
				wishlistId: input.id,
				actorId: currentUser.id,
				actorName: currentUser.name,
			});
		}

		// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the new
		// role in the same round trip, and the list moves from "Moje seznamy" to "Spravované"
		// on both dashboards without a reload.
		singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);
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
		const database = getDb();

		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);

		const [updated] = await database
			.update(wishlist)
			.set({ palette: input.palette, updatedAt: new Date() })
			.where(eq(wishlist.id, input.wishlistId))
			.returning();

		// Single-flight refresh (issue #108, REQ-3/4): only the open wishlist page query
		// rides back. Dashboards and nav dropdowns are NOT refreshed per mutation — those
		// surfaces re-fetch when they are actually opened, so refreshing them here only
		// burned three list queries per palette change.
		singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

		return updated;
	},
);

export const archiveWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Any manager (recipient or správce) may archive.
	const { wishlistRow } = await verifyManagerAccess(user.id, wishlistId);

	const [archived] = await database
		.update(wishlist)
		.set({
			status: 'archived',
			archivedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(wishlist.id, wishlistId))
		.returning();

	const followerRows = await database
		.select({ userId: wishlistFollower.userId })
		.from(wishlistFollower)
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), isNull(wishlistFollower.unfollowedAt)),
		);
	const moderatorRows = await database
		.select({ userId: moderatorAssignment.userId })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				isNull(moderatorAssignment.deletedAt),
			),
		);

	// Emails ride the background path inside the dispatcher (issue #108, REQ-6) —
	// archiving never waits for outbound delivery.
	await dispatchNotification({
		type: NOTIFICATION_TYPE.WISHLIST_ARCHIVED,
		targetUserIds: [...followerRows, ...moderatorRows]
			.map((row) => row.userId)
			.filter((targetUserId) => targetUserId !== user.id),
		wishlistId,
		actorId: user.id,
		actorName: user.name,
		wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
	});

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
	// archived status in the same round trip.
	singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

	return archived;
});

export const deleteWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Any manager (recipient or správce) may delete an unshared list.
	const { wishlistRow: row } = await verifyManagerAccess(user.id, wishlistId);
	if (row.sharedAt !== null) {
		error(400, 'Cannot delete a shared wishlist. Archive it instead.');
	}

	const giftImageRows = await database
		.select({ imageKey: gift.imageKey })
		.from(gift)
		.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)));

	// Soft delete
	await database
		.update(wishlist)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(wishlist.id, wishlistId));

	// Storage cleanup (issue #107, REQ-6): the wishlist image and all of its
	// gifts' uploaded images become unreachable with the list – drop the objects.
	await deleteObjectsBestEffort([row.imageKey, ...giftImageRows.map((g) => g.imageKey)]);

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
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
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
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
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
