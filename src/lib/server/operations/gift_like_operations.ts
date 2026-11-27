import { and, countDistinct, eq, inArray, isNull } from 'drizzle-orm';
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
import {
	assertNotSharedGiftRecipient,
	loadSharedGiftSiblings,
	sharedGiftRowIds,
} from './gift_link_group.js';

/**
 * Archived lists are read-only, and no recipient of a gift likes it (správci may). Returns the
 * gifts whose likes count as one: a shared gift's rows (issue #737), otherwise the gift alone.
 */
async function requireLikeableGift(
	context: MutationOperationContext,
	giftId: string,
): Promise<string[]> {
	const [giftRow] = await context.transaction
		.select({ id: gift.id, wishlistId: gift.wishlistId, linkGroupId: gift.linkGroupId })
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
	const sharedSiblings = await loadSharedGiftSiblings(context.transaction, giftRow);
	assertNotSharedGiftRecipient(
		sharedSiblings,
		context.actor.userId,
		SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS,
	);
	return sharedGiftRowIds(giftId, sharedSiblings);
}

/**
 * Likes are the actor's own interest, so agents never toggle them. A like of any row of a shared
 * gift likes the whole gift: unliking it from any list removes it everywhere.
 */
export const toggleGiftLikeOperation = defineOperation({
	name: 'toggleGiftLike',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: ToggleLikeInputSchema,
	async run(context, { giftId }): Promise<ToggleLikeResult> {
		const likedGiftIds = await requireLikeableGift(context, giftId);
		const actorLikes = await context.transaction
			.select()
			.from(giftLike)
			.where(
				and(
					inArray(giftLike.giftId, likedGiftIds),
					eq(giftLike.userId, context.actor.userId),
				),
			);
		const activeActorLikes = actorLikes.filter((like) => like.deletedAt === null);
		const existingLike = actorLikes.find((like) => like.giftId === giftId);
		if (activeActorLikes.length > 0) {
			await context.transaction
				.update(giftLike)
				.set({ deletedAt: context.now })
				.where(
					inArray(
						giftLike.id,
						activeActorLikes.map((like) => like.id),
					),
				);
		} else if (existingLike === undefined) {
			// A concurrent like of the same gift may win the active-like unique index; the gift
			// ends up liked either way.
			await context.transaction
				.insert(giftLike)
				.values({ giftId, userId: context.actor.userId })
				.onConflictDoNothing();
		} else {
			await context.transaction
				.update(giftLike)
				.set({ deletedAt: null })
				.where(eq(giftLike.id, existingLike.id));
		}
		const [activeLikers] = await context.transaction
			.select({ count: countDistinct(giftLike.userId) })
			.from(giftLike)
			.where(and(inArray(giftLike.giftId, likedGiftIds), isNull(giftLike.deletedAt)));
		return {
			liked: activeActorLikes.length === 0,
			likeCount: Number(activeLikers?.count ?? 0),
		};
	},
});
