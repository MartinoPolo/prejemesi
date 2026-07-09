import { eq, and, isNull, count as drizzleCount } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand, guardedQuery } from '$lib/server/remote.js';
import { ToggleLikeInputSchema, type ToggleLikeResult } from './types.js';

export const toggleLike = guardedCommand(
	ToggleLikeInputSchema,
	async ({ user }, input): Promise<ToggleLikeResult> => {
		const database = getDb();

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

		const wishlistRows = await database
			.select({ recipientUserId: wishlist.recipientUserId, status: wishlist.status })
			.from(wishlist)
			.where(and(eq(wishlist.id, giftRow.wishlistId), isNull(wishlist.deletedAt)))
			.limit(1);

		const wishlistRow = wishlistRows[0];
		if (wishlistRow === undefined) {
			error(404, 'Wishlist not found');
		}
		if (wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_LIKE_ON_ARCHIVED);
		}
		// Only the linked recipient is blocked (protects their own surprise); správci may like.
		if (wishlistRow.recipientUserId === user.id) {
			error(403, SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS);
		}

		const existingLikes = await database
			.select()
			.from(giftLike)
			.where(and(eq(giftLike.giftId, input.giftId), eq(giftLike.userId, user.id)))
			.limit(1);

		const existingLike = existingLikes[0];

		if (existingLike !== undefined) {
			if (existingLike.deletedAt === null) {
				await database
					.update(giftLike)
					.set({ deletedAt: new Date() })
					.where(eq(giftLike.id, existingLike.id));
			} else {
				await database
					.update(giftLike)
					.set({ deletedAt: null })
					.where(eq(giftLike.id, existingLike.id));
			}
		} else {
			await database.insert(giftLike).values({
				giftId: input.giftId,
				userId: user.id,
			});
		}

		const countResult = await database
			.select({ count: drizzleCount() })
			.from(giftLike)
			.where(and(eq(giftLike.giftId, input.giftId), isNull(giftLike.deletedAt)));

		const likeCount = Number(countResult[0]?.count ?? 0);

		const liked = existingLike === undefined ? true : existingLike.deletedAt !== null;

		return { liked, likeCount };
	},
);

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
