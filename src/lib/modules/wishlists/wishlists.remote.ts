import { eq, and, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { guardedCommand, guardedQuery, publicQuery } from '$lib/server/remote.js';
import {
	DEFAULT_PRIORITY_LEVELS,
	type CreateWishlistInput,
	type UpdateWishlistInput,
	type WishlistRole,
} from './types.js';
import type { ModeratedWishlist, FollowedWishlist } from './dashboard_types.js';

// ── Queries ──────────────────────────────────────────────────────────────────

export const getMyWishlists = guardedQuery(async ({ user }) => {
	const database = getDb();
	return database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.ownerId, user.id), isNull(wishlist.deletedAt)))
		.orderBy(wishlist.createdAt);
});

export const getWishlistByShortId = publicQuery(async (authContext, shortId: string) => {
	const database = getDb();

	const rows = await database
		.select({
			wishlist: wishlist,
			ownerName: user.name,
		})
		.from(wishlist)
		.innerJoin(user, eq(wishlist.ownerId, user.id))
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}

	// Determine role
	let role: WishlistRole = 'visitor';
	if (authContext !== null) {
		if (authContext.user.id === row.wishlist.ownerId) {
			role = 'owner';
		} else {
			const modRows = await database
				.select()
				.from(moderatorAssignment)
				.where(
					and(
						eq(moderatorAssignment.wishlistId, row.wishlist.id),
						eq(moderatorAssignment.userId, authContext.user.id),
						isNull(moderatorAssignment.deletedAt),
					),
				)
				.limit(1);

			if (modRows[0] !== undefined) {
				role = 'moderator';
			}
		}
	}

	return { ...row.wishlist, ownerName: row.ownerName, role } as const;
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
			ownerName: user.name,
			totalGifts: sql<number>`coalesce(${totalGiftsSubquery.count}, 0)`,
			reservedGifts: sql<number>`coalesce(${reservedGiftsSubquery.count}, 0)`,
		})
		.from(moderatorAssignment)
		.innerJoin(wishlist, eq(moderatorAssignment.wishlistId, wishlist.id))
		.innerJoin(user, eq(wishlist.ownerId, user.id))
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
			ownerName: row.ownerName,
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
			ownerName: user.name,
			availableGifts: sql<number>`coalesce(${availableGiftsSubquery.count}, 0)`,
			myReservations: sql<number>`coalesce(${myReservationsSubquery.count}, 0)`,
			unfollowedAt: wishlistFollower.unfollowedAt,
		})
		.from(wishlistFollower)
		.innerJoin(wishlist, eq(wishlistFollower.wishlistId, wishlist.id))
		.innerJoin(user, eq(wishlist.ownerId, user.id))
		.leftJoin(availableGiftsSubquery, eq(availableGiftsSubquery.wishlistId, wishlist.id))
		.leftJoin(myReservationsSubquery, eq(myReservationsSubquery.wishlistId, wishlist.id))
		.where(and(eq(wishlistFollower.userId, currentUser.id), isNull(wishlist.deletedAt)))
		.orderBy(wishlist.updatedAt);

	return rows.map(
		(row): FollowedWishlist => ({
			...row.wishlist,
			ownerName: row.ownerName,
			availableGifts: Number(row.availableGifts),
			myReservations: Number(row.myReservations),
			unfollowedAt: row.unfollowedAt,
		}),
	);
});

// ── Commands ─────────────────────────────────────────────────────────────────

export const createWishlist = guardedCommand(async ({ user }, input: CreateWishlistInput) => {
	const database = getDb();

	const [created] = await database
		.insert(wishlist)
		.values({
			ownerId: user.id,
			title: input.title,
			eventDate: input.eventDate ?? null,
			theme: input.theme ?? 'default',
		})
		.returning();

	if (created === undefined) {
		error(500, 'Failed to create wishlist');
	}

	// Auto-create default priority levels
	await database.insert(priorityLevel).values(
		DEFAULT_PRIORITY_LEVELS.map((level) => ({
			wishlistId: created.id,
			label: level.label,
			sortOrder: level.sortOrder,
		})),
	);

	return created;
});

export const updateWishlist = guardedCommand(async ({ user }, input: UpdateWishlistInput) => {
	const database = getDb();

	// Verify ownership
	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, input.id), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}

	// Edit lock: if shared, only allow limited field updates
	const isShared = row.sharedAt !== null;

	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	// Title and description can always be updated
	if (input.title !== undefined) {
		updateData['title'] = input.title;
	}
	if (input.description !== undefined) {
		updateData['description'] = input.description;
	}

	// Event date is locked after sharing
	if (!isShared) {
		if (input.eventDate !== undefined) {
			updateData['eventDate'] = input.eventDate;
		}
	}

	// Theme can always be updated (visual preference, not content)
	if (input.theme !== undefined) {
		updateData['theme'] = input.theme;
	}
	if (input.customThemeColor !== undefined) {
		updateData['customThemeColor'] = input.customThemeColor;
	}

	// Images can always be updated
	if (input.bannerImageKey !== undefined) {
		updateData['bannerImageKey'] = input.bannerImageKey;
	}
	if (input.thumbnailImageKey !== undefined) {
		updateData['thumbnailImageKey'] = input.thumbnailImageKey;
	}

	const [updated] = await database
		.update(wishlist)
		.set(updateData)
		.where(eq(wishlist.id, input.id))
		.returning();

	return updated;
});

export const archiveWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}

	const [archived] = await database
		.update(wishlist)
		.set({
			status: 'archived',
			archivedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(wishlist.id, wishlistId))
		.returning();

	return archived;
});

export const deleteWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	const existing = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = existing[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}
	if (row.sharedAt !== null) {
		error(400, 'Cannot delete a shared wishlist. Archive it instead.');
	}

	// Soft delete
	await database
		.update(wishlist)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(wishlist.id, wishlistId));
});

// ── Follower Commands ──────────────────────────────────────────────────────

/**
 * Auto-follow a wishlist on first visit.
 * No-op if user is the owner or already following.
 */
export const followWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	// Verify wishlist exists
	const wishlistRows = await database
		.select({ ownerId: wishlist.ownerId })
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, 'Wishlist not found');
	}

	// Don't follow own wishlist
	if (wishlistRow.ownerId === user.id) {
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

/**
 * Unfollow a wishlist. Sets unfollowedAt timestamp.
 */
export const unfollowWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	await database
		.update(wishlistFollower)
		.set({ unfollowedAt: new Date() })
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		);
});

/**
 * Re-follow a previously unfollowed wishlist. Clears unfollowedAt.
 */
export const refollowWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	await database
		.update(wishlistFollower)
		.set({ unfollowedAt: null, lastVisitedAt: new Date() })
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), eq(wishlistFollower.userId, user.id)),
		);
});
