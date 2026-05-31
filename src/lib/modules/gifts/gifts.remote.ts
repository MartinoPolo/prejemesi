import 'use server';

import { eq, and, isNull, sql, count as drizzleCount } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { publicCommand } from '$lib/server/remote.js';
import type { GiftForOwner, GiftForVisitor } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

/**
 * Fetch gifts for a wishlist by its shortId.
 * Determines viewer role and strips reservation data for owners.
 */
export const getGiftsByWishlistShortId = publicCommand(async (authContext, shortId: string) => {
	const database = getDb();

	// Find wishlist
	const wishlistRows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, 'Wishlist not found');
	}

	// Determine role
	let role: WishlistRole = 'visitor';
	if (authContext !== null) {
		if (authContext.user.id === wishlistRow.ownerId) {
			role = 'owner';
		} else {
			// Check moderator assignment
			const modRows = await database
				.select()
				.from(moderatorAssignment)
				.where(
					and(
						eq(moderatorAssignment.wishlistId, wishlistRow.id),
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

	// Fetch gifts with priority info
	const giftRows = await database
		.select({
			id: gift.id,
			wishlistId: gift.wishlistId,
			name: gift.name,
			description: gift.description,
			url: gift.url,
			price: gift.price,
			currency: gift.currency,
			imageUrl: gift.imageUrl,
			quantity: gift.quantity,
			sortOrder: gift.sortOrder,
			received: gift.received,
			createdAt: gift.createdAt,
			priorityLabel: priorityLevel.label,
			prioritySortOrder: priorityLevel.sortOrder,
		})
		.from(gift)
		.leftJoin(priorityLevel, eq(gift.priorityLevelId, priorityLevel.id))
		.where(and(eq(gift.wishlistId, wishlistRow.id), isNull(gift.deletedAt)))
		.orderBy(gift.sortOrder);

	if (role === 'owner') {
		// Owner: no reservation data, no like counts
		const ownerGifts: GiftForOwner[] = giftRows.map((row) => ({
			id: row.id,
			wishlistId: row.wishlistId,
			name: row.name,
			description: row.description,
			url: row.url,
			price: row.price,
			currency: row.currency,
			imageUrl: row.imageUrl,
			quantity: row.quantity,
			sortOrder: row.sortOrder,
			received: row.received,
			createdAt: row.createdAt,
			priorityLabel: row.priorityLabel,
			prioritySortOrder: row.prioritySortOrder,
		}));

		return { role, gifts: ownerGifts } as const;
	}

	// Visitor/Moderator: include reservation counts and like counts
	const giftIds = giftRows.map((row) => row.id);

	// Batch fetch reservation counts
	const reservationCounts = new Map<string, number>();
	if (giftIds.length > 0) {
		const resCounts = await database
			.select({
				giftId: reservation.giftId,
				totalQuantity: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)`.as(
					'total_quantity',
				),
			})
			.from(reservation)
			.where(and(isNull(reservation.deletedAt)))
			.groupBy(reservation.giftId);

		for (const row of resCounts) {
			reservationCounts.set(row.giftId, Number(row.totalQuantity));
		}
	}

	// Batch fetch like counts
	const likeCounts = new Map<string, number>();
	if (giftIds.length > 0) {
		const lkCounts = await database
			.select({
				giftId: giftLike.giftId,
				count: drizzleCount(),
			})
			.from(giftLike)
			.where(isNull(giftLike.deletedAt))
			.groupBy(giftLike.giftId);

		for (const row of lkCounts) {
			likeCounts.set(row.giftId, Number(row.count));
		}
	}

	const visitorGifts: GiftForVisitor[] = giftRows.map((row) => {
		const qty = row.quantity ?? 1;
		const reserved = reservationCounts.get(row.id) ?? 0;
		return {
			id: row.id,
			wishlistId: row.wishlistId,
			name: row.name,
			description: row.description,
			url: row.url,
			price: row.price,
			currency: row.currency,
			imageUrl: row.imageUrl,
			quantity: row.quantity,
			sortOrder: row.sortOrder,
			received: row.received,
			createdAt: row.createdAt,
			priorityLabel: row.priorityLabel,
			prioritySortOrder: row.prioritySortOrder,
			likeCount: likeCounts.get(row.id) ?? 0,
			reservedCount: reserved,
			isFullyReserved: reserved >= qty,
		};
	});

	return { role, gifts: visitorGifts } as const;
});
