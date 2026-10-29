import { and, count, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { ToggleLikeInputSchema, type ToggleLikeResult } from '$lib/modules/likes/types.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { keyShareLockViewedWishlistRow } from './wishlist_management.js';

/** Archived lists are read-only, and the linked recipient never likes their own gifts (správci may). */
async function requireLikeableGiftWishlist(
	context: MutationOperationContext,
	giftId: string,
): Promise<void> {
	const [giftRow] = await context.transaction
		.select({ id: gift.id, wishlistId: gift.wishlistId })
		.from(gift)
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt)))
		.limit(1);
	if (giftRow === undefined) {
		error(404, 'Gift not found');
	}
	const wishlistRow = await keyShareLockViewedWishlistRow(
		context.transaction,
		giftRow.wishlistId,
	);
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_LIKE_ON_ARCHIVED);
	}
	if (wishlistRow.recipientUserId === context.actor.userId) {
		error(403, SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS);
	}
}

/** Likes are the actor's own interest, so agents never toggle them. */
export const toggleGiftLikeOperation = defineOperation({
	name: 'toggleGiftLike',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: ToggleLikeInputSchema,
	async run(context, { giftId }): Promise<ToggleLikeResult> {
		await requireLikeableGiftWishlist(context, giftId);
		const [existingLike] = await context.transaction
			.select()
			.from(giftLike)
			.where(and(eq(giftLike.giftId, giftId), eq(giftLike.userId, context.actor.userId)))
			.limit(1);
		if (existingLike === undefined) {
			// A concurrent like of the same gift may win the active-like unique index; the gift
			// ends up liked either way.
			await context.transaction
				.insert(giftLike)
				.values({ giftId, userId: context.actor.userId })
				.onConflictDoNothing();
		} else {
			await context.transaction
				.update(giftLike)
				.set({ deletedAt: existingLike.deletedAt === null ? context.now : null })
				.where(eq(giftLike.id, existingLike.id));
		}
		const [activeLikes] = await context.transaction
			.select({ count: count() })
			.from(giftLike)
			.where(and(eq(giftLike.giftId, giftId), isNull(giftLike.deletedAt)));
		return {
			liked: existingLike === undefined || existingLike.deletedAt !== null,
			likeCount: Number(activeLikes?.count ?? 0),
		};
	},
});
