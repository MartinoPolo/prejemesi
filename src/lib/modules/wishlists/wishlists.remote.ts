import * as v from 'valibot';
import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { isAppAdmin } from '$lib/server/admin.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
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
import {
	resolveWishlistRole,
	verifyManagerAccess,
	verifyLinkedRecipientAccess,
	assertWishlistMutable,
} from './wishlist_access.js';
import { resolveRevertCapability } from './wishlist_capabilities.js';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	RenameRecipientInputSchema,
	FlipRecipientToFreeTextInputSchema,
	SetWishlistPaletteInputSchema,
	WISHLIST_ROLES,
	type WishlistRole,
} from './types.js';
import type { ModeratedWishlist, FollowedWishlist, MyWishlist } from './dashboard_types.js';

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * SQL for "who the list is for": the linked recipient's account name (left-joined on
 * `recipientUserId`) or the free-text `recipientName`. Requires a leftJoin on `user`.
 */
function recipientDisplayNameSql() {
	return sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`;
}

export const getMyWishlists = guardedQuery(async ({ user }) => {
	const database = getDb();

	const totalGiftsSubquery = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('total_gifts'),
		})
		.from(gift)
		.where(isNull(gift.deletedAt))
		.groupBy(gift.wishlistId)
		.as('my_total_gifts_sq');

	const rows = await database
		.select({
			wishlist: wishlist,
			totalGifts: sql<number>`coalesce(${totalGiftsSubquery.count}, 0)`,
		})
		.from(wishlist)
		.leftJoin(totalGiftsSubquery, eq(totalGiftsSubquery.wishlistId, wishlist.id))
		.where(and(eq(wishlist.recipientUserId, user.id), isNull(wishlist.deletedAt)))
		.orderBy(wishlist.updatedAt);

	return rows.map(
		(row): MyWishlist => ({
			...row.wishlist,
			totalGifts: Number(row.totalGifts),
		}),
	);
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
	} as const;
});

export const getModeratedWishlists = guardedQuery(async ({ user: currentUser }) => {
	const database = getDb();

	const totalGiftsSubquery = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('total_gifts'),
		})
		.from(gift)
		.where(isNull(gift.deletedAt))
		.groupBy(gift.wishlistId)
		.as('total_gifts_sq');

	const reservedGiftsSubquery = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(distinct ${gift.id})`.as('reserved_gifts'),
		})
		.from(gift)
		.innerJoin(reservation, and(eq(reservation.giftId, gift.id), isNull(reservation.deletedAt)))
		.where(isNull(gift.deletedAt))
		.groupBy(gift.wishlistId)
		.as('reserved_gifts_sq');

	const rows = await database
		.select({
			wishlist: wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			totalGifts: sql<number>`coalesce(${totalGiftsSubquery.count}, 0)`,
			reservedGifts: sql<number>`coalesce(${reservedGiftsSubquery.count}, 0)`,
		})
		.from(moderatorAssignment)
		.innerJoin(wishlist, eq(moderatorAssignment.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(totalGiftsSubquery, eq(totalGiftsSubquery.wishlistId, wishlist.id))
		.leftJoin(reservedGiftsSubquery, eq(reservedGiftsSubquery.wishlistId, wishlist.id))
		.where(
			and(
				eq(moderatorAssignment.userId, currentUser.id),
				isNull(moderatorAssignment.deletedAt),
				isNull(wishlist.deletedAt),
			),
		)
		.orderBy(wishlist.updatedAt);

	return rows.map(
		(row): ModeratedWishlist => ({
			...row.wishlist,
			recipientDisplayName: row.recipientDisplayName,
			totalGifts: Number(row.totalGifts),
			reservedGifts: Number(row.reservedGifts),
		}),
	);
});

export const getFollowedWishlists = guardedQuery(async ({ user: currentUser }) => {
	const database = getDb();

	const availableGiftsSubquery = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('available_gifts'),
		})
		.from(gift)
		.leftJoin(reservation, and(eq(reservation.giftId, gift.id), isNull(reservation.deletedAt)))
		.where(and(isNull(gift.deletedAt), isNull(reservation.id)))
		.groupBy(gift.wishlistId)
		.as('available_gifts_sq');

	const myReservationsSubquery = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('my_reservations'),
			purchasedCount:
				sql<number>`count(*) filter (where ${reservation.purchasedAt} is not null)`.as(
					'my_purchased',
				),
		})
		.from(reservation)
		.innerJoin(gift, eq(reservation.giftId, gift.id))
		.where(
			and(
				eq(reservation.userId, currentUser.id),
				isNull(reservation.deletedAt),
				isNull(gift.deletedAt),
			),
		)
		.groupBy(gift.wishlistId)
		.as('my_reservations_sq');

	const rows = await database
		.select({
			wishlist: wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			availableGifts: sql<number>`coalesce(${availableGiftsSubquery.count}, 0)`,
			myReservations: sql<number>`coalesce(${myReservationsSubquery.count}, 0)`,
			myPurchased: sql<number>`coalesce(${myReservationsSubquery.purchasedCount}, 0)`,
			unfollowedAt: wishlistFollower.unfollowedAt,
		})
		.from(wishlistFollower)
		.innerJoin(wishlist, eq(wishlistFollower.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(availableGiftsSubquery, eq(availableGiftsSubquery.wishlistId, wishlist.id))
		.leftJoin(myReservationsSubquery, eq(myReservationsSubquery.wishlistId, wishlist.id))
		.where(and(eq(wishlistFollower.userId, currentUser.id), isNull(wishlist.deletedAt)))
		.orderBy(wishlist.updatedAt);

	return rows.map(
		(row): FollowedWishlist => ({
			...row.wishlist,
			recipientDisplayName: row.recipientDisplayName,
			availableGifts: Number(row.availableGifts),
			myReservations: Number(row.myReservations),
			myPurchased: Number(row.myPurchased),
			unfollowedAt: row.unfollowedAt,
		}),
	);
});

// ── Commands ─────────────────────────────────────────────────────────────────

export const createWishlist = guardedCommand(CreateWishlistInputSchema, async ({ user }, input) => {
	const database = getDb();
	return database.transaction((tx) => seedNewWishlist(tx, user.id, input));
});

export const updateWishlist = guardedCommand(UpdateWishlistInputSchema, async ({ user }, input) => {
	const database = getDb();

	// Any manager (recipient or správce) may edit list metadata/theme/image (issue #99).
	const { wishlistRow: row } = await verifyManagerAccess(user.id, input.id);
	if (row.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}

	// Edit lock: if shared, only allow limited field updates
	const now = new Date();
	const isShared = row.sharedAt !== null;

	const updateData: Record<string, unknown> = { updatedAt: now };

	// Title and description can always be updated
	if (input.title !== undefined) {
		updateData['title'] = input.title;
	}
	if (input.description !== undefined) {
		updateData['description'] = input.description;
	}

	// Event date locks at share time, but stays editable within the debounced 2-min grace window
	// (REQ-4). The window resets on each in-window edit, so it is keyed off `eventDateEditedAt`
	// (the last edit) and falls back to `sharedAt` until then. Stale clients past the window are
	// rejected here – the server is the authority (REQ-6).
	const eventDateGraceOpen =
		isShared && isWithinGraceWindow(row.eventDateEditedAt ?? row.sharedAt, now);
	if (input.eventDate !== undefined && (!isShared || eventDateGraceOpen)) {
		updateData['eventDate'] = input.eventDate;
		if (isShared) {
			updateData['eventDateEditedAt'] = now;
		}
	}

	// Image assignment + per-slot crop metadata can always be updated
	if (input.imageKey !== undefined) {
		updateData['imageKey'] = input.imageKey;
	}
	if (input.imageSlots !== undefined) {
		updateData['imageSlots'] = input.imageSlots;
	}

	const [updated] = await database
		.update(wishlist)
		.set(updateData)
		.where(eq(wishlist.id, input.id))
		.returning();

	// Storage cleanup (issue #107, REQ-6): a replaced or removed wishlist image
	// leaves no unreferenced R2 object behind.
	if (input.imageKey !== undefined && row.imageKey !== null && row.imageKey !== input.imageKey) {
		await deleteObjectsBestEffort([row.imageKey]);
	}

	// Single-flight refresh (issue #108, REQ-3/4): the settings/wishlist pages track
	// this query, so the saved metadata rides back on the command response.
	singleFlightRefresh(getWishlistByShortId, row.shortId);

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
