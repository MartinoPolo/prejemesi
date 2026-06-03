import * as v from 'valibot';
import { eq, and, isNull, sql, count as drizzleCount, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { publicQuery, guardedCommand, guardedQueryWithArgs } from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	ReorderGiftItemSchema,
	MarkGiftReceivedInputSchema,
	type GiftForOwner,
	type GiftForVisitor,
} from './types.js';
import { normalizeGiftUrl } from './gift_url.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

export const getGiftsByWishlistShortId = publicQuery(v.string(), async (authContext, shortId) => {
	const database = getDb();

	// Find wishlist
	const wishlistRows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.shortId, shortId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = wishlistRows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
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
			imageKey: gift.imageKey,
			imageMeta: gift.imageMeta,
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

	if (role === 'owner' && wishlistRow.ownerIsModerator === false) {
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
			imageKey: row.imageKey,
			imageMeta: row.imageMeta,
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

	// Batch fetch reservation counts (scoped to this wishlist's gifts)
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
			.where(and(inArray(reservation.giftId, giftIds), isNull(reservation.deletedAt)))
			.groupBy(reservation.giftId);

		for (const row of resCounts) {
			reservationCounts.set(row.giftId, Number(row.totalQuantity));
		}
	}

	// Batch fetch like counts (scoped to this wishlist's gifts)
	const likeCounts = new Map<string, number>();
	if (giftIds.length > 0) {
		const lkCounts = await database
			.select({
				giftId: giftLike.giftId,
				count: drizzleCount(),
			})
			.from(giftLike)
			.where(and(inArray(giftLike.giftId, giftIds), isNull(giftLike.deletedAt)))
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
			imageKey: row.imageKey,
			imageMeta: row.imageMeta,
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
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
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

	error(403, SERVER_ERROR.ACCESS_DENIED);
}

function assertWishlistMutable(wishlistRow: typeof wishlist.$inferSelect) {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
}

// ── Commands ────────────────────────────────────────────────────────────────

export const createGift = guardedCommand(CreateGiftInputSchema, async ({ user }, input) => {
	const database = getDb();
	const { wishlistRow } = await verifyOwnerOrModerator(user.id, input.wishlistId);
	assertWishlistMutable(wishlistRow);

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
			url: normalizeGiftUrl(input.url),
			price: input.price ?? null,
			currency: input.currency ?? 'CZK',
			imageUrl: input.imageUrl ?? null,
			imageKey: input.imageKey ?? null,
			imageMeta: input.imageMeta ?? null,
			quantity: input.quantity ?? 1,
			priorityLevelId: input.priorityLevelId ?? null,
			sortOrder: nextSortOrder,
		})
		.returning();

	if (created === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}

	return created;
});

export const updateGift = guardedCommand(UpdateGiftInputSchema, async ({ user }, input) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, input.id), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyOwnerOrModerator(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Edit lock: owner cannot edit existing gifts after sharing
	const isShared = wishlistRow.sharedAt !== null;
	if (role === 'owner' && isShared) {
		// Check if this gift was created before sharing
		if (giftRow.createdAt <= wishlistRow.sharedAt!) {
			error(403, SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING);
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
		updateData['url'] = normalizeGiftUrl(input.url);
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
	if (input.imageMeta !== undefined) {
		updateData['imageMeta'] = input.imageMeta;
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

export const deleteGift = guardedCommand(v.string(), async ({ user }, giftId) => {
	const database = getDb();

	// Find the gift
	const giftRows = await database
		.select()
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.limit(1);

	const giftRow = giftRows[0];
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	const { role, wishlistRow } = await verifyOwnerOrModerator(user.id, giftRow.wishlistId);
	assertWishlistMutable(wishlistRow);

	// Edit lock: owner cannot delete existing gifts after sharing
	const isShared = wishlistRow.sharedAt !== null;
	if (role === 'owner' && isShared) {
		if (giftRow.createdAt <= wishlistRow.sharedAt!) {
			error(403, SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
		}
	}

	// Cannot delete reserved gifts
	const reservationRows = await database
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.limit(1);

	if (reservationRows[0] !== undefined) {
		error(400, SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
	}

	// Soft delete
	await database
		.update(gift)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(gift.id, giftId));
});

export const reorderGifts = guardedCommand(
	v.array(ReorderGiftItemSchema),
	async ({ user }, items) => {
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
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		const { wishlistRow } = await verifyOwnerOrModerator(user.id, firstGift.wishlistId);
		assertWishlistMutable(wishlistRow);

		const uniqueGiftIds = [...new Set(items.map((item) => item.id))];
		const reorderedGiftRows = await database
			.select({ id: gift.id, wishlistId: gift.wishlistId })
			.from(gift)
			.where(and(inArray(gift.id, uniqueGiftIds), isNull(gift.deletedAt)));

		if (
			reorderedGiftRows.length !== uniqueGiftIds.length ||
			reorderedGiftRows.some((row) => row.wishlistId !== firstGift.wishlistId) === true
		) {
			error(403, 'Cannot reorder gifts from another wishlist');
		}

		// Batch update sortOrder in a single CASE WHEN statement
		const now = new Date();
		const sortOrderCase = sql.join(
			items.map((item) => sql`WHEN ${gift.id} = ${item.id} THEN ${item.sortOrder}`),
			sql` `,
		);
		await database
			.update(gift)
			.set({
				sortOrder: sql`CASE ${sortOrderCase} END`,
				updatedAt: now,
			})
			.where(
				and(
					inArray(
						gift.id,
						items.map((item) => item.id),
					),
					eq(gift.wishlistId, firstGift.wishlistId),
					isNull(gift.deletedAt),
				),
			);
	},
);

export const markGiftReceived = guardedCommand(
	MarkGiftReceivedInputSchema,
	async ({ user }, input) => {
		const database = getDb();

		const giftRows = await database
			.select()
			.from(gift)
			.where(and(eq(gift.id, input.giftId), isNull(gift.deletedAt)))
			.limit(1);

		const giftRow = giftRows[0];
		if (giftRow === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		// Only owner can mark as received
		const wishlistRows = await database
			.select()
			.from(wishlist)
			.where(eq(wishlist.id, giftRow.wishlistId))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
		}
		assertWishlistMutable(wishlistRow);
		if (wishlistRow.ownerId !== user.id) {
			error(403, SERVER_ERROR.ONLY_OWNER_CAN_MARK_RECEIVED);
		}

		const [updated] = await database
			.update(gift)
			.set({ received: input.received, updatedAt: new Date() })
			.where(eq(gift.id, input.giftId))
			.returning();

		return updated;
	},
);

/** Fetch priority levels for a wishlist */
export const getPriorityLevels = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	// Verify access
	await verifyOwnerOrModerator(user.id, wishlistId);

	return database
		.select()
		.from(priorityLevel)
		.where(eq(priorityLevel.wishlistId, wishlistId))
		.orderBy(priorityLevel.sortOrder);
});
