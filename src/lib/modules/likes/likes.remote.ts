import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { guardedCommand, guardedQuery, guardedQueryWithArgs } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { toggleGiftLikeOperation } from '$lib/server/operations/gift_like_operations.js';
import { ToggleLikeInputSchema, type ToggleLikeResult } from './types.js';

// The operation core owns who may like a gift; the reads below return only the caller's own likes.

export const toggleLike = guardedCommand(
	ToggleLikeInputSchema,
	({ user }, input): Promise<ToggleLikeResult> =>
		executeOperation(userInterfaceActor(user), toggleGiftLikeOperation, input),
);

// Expand/contract compatibility: keep this no-argument remote export until old browser
// clients using its deployed remote ID have aged out.
export const getUserLikesForWishlist = guardedQuery(async ({ user }) => {
	const database = getDb();
	const likes = await database
		.select({ giftId: giftLike.giftId })
		.from(giftLike)
		.where(and(eq(giftLike.userId, user.id), isNull(giftLike.deletedAt)));
	return likes.map((row) => row.giftId);
});

export const getUserLikesForWishlistScoped = guardedQueryWithArgs(
	v.object({ wishlistId: v.string() }),
	async ({ user }, { wishlistId }) => {
		const database = getDb();

		const likes = await database
			.select({
				giftId: giftLike.giftId,
			})
			.from(giftLike)
			.innerJoin(gift, eq(giftLike.giftId, gift.id))
			.where(
				and(
					eq(giftLike.userId, user.id),
					isNull(giftLike.deletedAt),
					eq(gift.wishlistId, wishlistId),
					isNull(gift.deletedAt),
				),
			);

		return likes.map((row) => row.giftId);
	},
);
