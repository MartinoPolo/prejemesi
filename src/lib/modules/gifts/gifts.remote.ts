import 'use server';

import { eq, and, isNull, sql, count as drizzleCount } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { publicCommand, guardedCommand } from '$lib/server/remote.js';
import type {
	GiftForOwner,
	GiftForVisitor,
	CreateGiftInput,
	UpdateGiftInput,
	ReorderGiftItem,
} from './types.js';
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

	if (role === 'owner' && !wishlistRow.ownerIsModerator) {
		// Owner without self-promote: no reservation data, no like counts
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

	// Owner with self-promote sees reservation data (role stays 'owner' for UI)

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

// ── Helper: verify owner or moderator role for a wishlist ───────────────────

async function verifyOwnerOrModerator(
	userId: string,
	wishlistId: string,
): Promise<{ role: WishlistRole; wishlistRow: typeof wishlist.$inferSelect }> {
	const database = getDb();

	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = rows[0];
	if (wishlistRow === undefined) {
		error(404, 'Wishlist not found');
	}

	if (wishlistRow.ownerId === userId) {
		return { role: 'owner', wishlistRow };
	}

	const modRows = await database
		.select()
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);

	if (modRows[0] !== undefined) {
		return { role: 'moderator', wishlistRow };
	}

	error(403, 'Not authorized');
}

// ── Commands ────────────────────────────────────────────────────────────────

export const createGift = guardedCommand(async ({ user }, input: CreateGiftInput) => {
	const database = getDb();
	await verifyOwnerOrModerator(user.id, input.wishlistId);

	// Determine sortOrder: place at the end
	const maxSortRows = await database
		.select({ maxSort: sql<number>`COALESCE(MAX(${gift.sortOrder}), -1)` })
		.from(gift)
		.where(and(eq(gift.wishlistId, input.wishlistId), isNull(gift.deletedAt)));

	const nextSortOrder = input.sortOrder ?? Number(maxSortRows[0]?.maxSort ?? -1) + 1;

	const [created] = await database
		.insert(gift)
		.values({
			wishlistId: input.wishlistId,
			name: input.name,
			description: input.description ?? null,
			url: input.url ?? null,
			price: input.price ?? null,
			currency: input.currency ?? 'CZK',
			imageUrl: input.imageUrl ?? null,
			imageKey: input.imageKey ?? null,
			quantity: input.quantity ?? 1,
			priorityLevelId: input.priorityLevelId ?? null,
			sortOrder: nextSortOrder,
		})
		.returning();

	if (created === undefined) {
		error(500, 'Failed to create gift');
	}

	return created;
});

export const updateGift = guardedCommand(async ({ user }, input: UpdateGiftInput) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, input.id), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, 'Gift not found');
	}

	const { role, wishlistRow } = await verifyOwnerOrModerator(user.id, giftRow.wishlistId);

	// Edit lock: owner cannot edit existing gifts after sharing
	const isShared = wishlistRow.sharedAt !== null;
	if (role === 'owner' && isShared) {
		// Check if this gift was created before sharing
		if (giftRow.createdAt <= wishlistRow.sharedAt!) {
			error(403, 'Cannot edit existing gifts after sharing the wishlist');
		}
	}

	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	if (input.name !== undefined) {
		updateData['name'] = input.name;
	}
	if (input.description !== undefined) {
		updateData['description'] = input.description;
	}
	if (input.url !== undefined) {
		updateData['url'] = input.url;
	}
	if (input.price !== undefined) {
		updateData['price'] = input.price;
	}
	if (input.currency !== undefined) {
		updateData['currency'] = input.currency;
	}
	if (input.imageUrl !== undefined) {
		updateData['imageUrl'] = input.imageUrl;
	}
	if (input.imageKey !== undefined) {
		updateData['imageKey'] = input.imageKey;
	}
	if (input.quantity !== undefined) {
		updateData['quantity'] = input.quantity;
	}
	if (input.priorityLevelId !== undefined) {
		updateData['priorityLevelId'] = input.priorityLevelId;
	}

	const [updated] = await database
		.update(gift)
		.set(updateData)
		.where(eq(gift.id, input.id))
		.returning();

	return updated;
});

export const deleteGift = guardedCommand(async ({ user }, giftId: string) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, 'Gift not found');
	}

	const { role, wishlistRow } = await verifyOwnerOrModerator(user.id, giftRow.wishlistId);

	// Edit lock: owner cannot delete existing gifts after sharing
	const isShared = wishlistRow.sharedAt !== null;
	if (role === 'owner' && isShared) {
		if (giftRow.createdAt <= wishlistRow.sharedAt!) {
			error(403, 'Cannot delete existing gifts after sharing the wishlist');
		}
	}

	// Cannot delete reserved gifts
	const reservationRows = await database
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.limit(1);

	if (reservationRows[0] !== undefined) {
		error(400, 'Cannot delete a reserved gift');
	}

	// Soft delete
	await database
		.update(gift)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(gift.id, giftId));
});

export const reorderGifts = guardedCommand(async ({ user }, items: ReorderGiftItem[]) => {
	if (items.length === 0) {
		return;
	}

	const database = getDb();

	// Get the wishlistId from the first gift
	const firstGiftRows = await database
		.select({ wishlistId: gift.wishlistId })
		.from(gift)
		.where(eq(gift.id, items[0]!.id))
		.limit(1);

	const firstGift = firstGiftRows[0];
	if (firstGift === undefined) {
		error(404, 'Gift not found');
	}

	await verifyOwnerOrModerator(user.id, firstGift.wishlistId);

	// Batch update sortOrder
	for (const item of items) {
		await database
			.update(gift)
			.set({ sortOrder: item.sortOrder, updatedAt: new Date() })
			.where(and(eq(gift.id, item.id), isNull(gift.deletedAt)));
	}
});

export const markGiftReceived = guardedCommand(
	async ({ user }, giftId: string, received: boolean) => {
		const database = getDb();

		const giftRows = await database
			.select()
			.from(gift)
			.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
			.limit(1);

		const giftRow = giftRows[0];
		if (giftRow === undefined) {
			error(404, 'Gift not found');
		}

		// Only owner can mark as received
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(eq(wishlist.id, giftRow.wishlistId))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, 'Wishlist not found');
		}
		if (wishlistRow.ownerId !== user.id) {
			error(403, 'Only the owner can mark gifts as received');
		}

		const [updated] = await database
			.update(gift)
			.set({ received, updatedAt: new Date() })
			.where(eq(gift.id, giftId))
			.returning();

		return updated;
	},
);

/** Fetch priority levels for a wishlist */
export const getPriorityLevels = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	// Verify access
	await verifyOwnerOrModerator(user.id, wishlistId);

	return database
		.select()
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(priorityLevel.sortOrder);
});
