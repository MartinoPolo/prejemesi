import { eq, and, isNull, count as drizzleCount } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand, guardedQuery } from '$lib/server/remote.js';
import type { ToggleLikeInput, ToggleLikeResult } from './types.js';

/**
 * Toggle like on a gift. Insert or soft-delete.
 * Owner of the wishlist CANNOT like their own gifts.
 */
export const toggleLike = guardedCommand(
	async ({ user }, input: ToggleLikeInput): Promise<ToggleLikeResult> => {
		const database = getDb();

		// Find the gift and its wishlist
		const giftRows = await database
			.select({
				id: gift.id,
				wishlistId: gift.wishlistId,
			})
			.from(gift)
			.where(and(eq(gift.id, input.giftId), isNull(gift.deletedAt)))
			.limit(1);

		const giftRow = giftRows[0];
		if (giftRow === undefined) {
			error(404, 'Gift not found');
		}

		// Check if user is the owner — owners cannot like their own gifts
		const wishlistRows = await database
			.select({ ownerId: wishlist.ownerId })
			.from(wishlist)
			.where(eq(wishlist.id, giftRow.wishlistId))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, 'Wishlist not found');
		}
		if (wishlistRow.ownerId === user.id) {
			error(403, 'Vlastnik nemuze likovat sve darky');
		}

		// Check for existing like (active or soft-deleted)
		const existingLikes = await database
			.select()
			.from(giftLike)
			.where(and(eq(giftLike.giftId, input.giftId), eq(giftLike.userId, user.id)))
			.limit(1);

		const existingLike = existingLikes[0];

		if (existingLike !== undefined) {
			if (existingLike.deletedAt === null) {
				// Currently liked — soft-delete (unlike)
				await database
					.update(giftLike)
					.set({ deletedAt: new Date() })
					.where(eq(giftLike.id, existingLike.id));
			} else {
				// Previously unliked — re-activate
				await database
					.update(giftLike)
					.set({ deletedAt: null })
					.where(eq(giftLike.id, existingLike.id));
			}
		} else {
			// No existing record — create new like
			await database.insert(giftLike).values({
				giftId: input.giftId,
				userId: user.id,
			});
		}

		// Get updated like count
		const countResult = await database
			.select({ count: drizzleCount() })
			.from(giftLike)
			.where(and(eq(giftLike.giftId, input.giftId), isNull(giftLike.deletedAt)));

		const likeCount = Number(countResult[0]?.count ?? 0);

		// Determine new liked state
		const liked =
			existingLike === undefined
				? true // new like
				: existingLike.deletedAt !== null; // was deleted, now re-activated

		return { liked, likeCount };
	},
);

/**
 * Get all giftIds the current user has liked (for a specific wishlist).
 * Used to hydrate like state on page load.
 */
export const getUserLikesForWishlist = guardedQuery(async ({ user }) => {
	const database = getDb();

	const likes = await database
		.select({
			giftId: giftLike.giftId,
		})
		.from(giftLike)
		.where(and(eq(giftLike.userId, user.id), isNull(giftLike.deletedAt)));

	return likes.map((row) => row.giftId);
});
