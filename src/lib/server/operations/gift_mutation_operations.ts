import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { rejectDemoGiftImages } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import {
	CreateGiftInputSchema,
	MarkGiftReceivedInputSchema,
	UpdateGiftInputSchema,
	type CreateGiftInput,
} from '$lib/modules/gifts/types.js';
import { requestedGiftCategoryIds } from '$lib/modules/gift-categories/gift_category_assignment.js';
import { appendGiftsUsingTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import { mapGiftCreationError } from '$lib/modules/gifts/gift_creation_transport.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import {
	KEY_SHARE_WISHLIST_LOCK,
	requireWishlistManagement,
	type ManagedWishlist,
} from './wishlist_management.js';
import { applyGiftUpdate, type GiftRow } from './gift_update.js';
import { softDeleteGift } from './gift_deletion.js';
import { lockedGiftFollowsStrictPostShareRules } from './wishlist_kind_rules.js';

/**
 * Resolves the actor's management of an active gift's wishlist, then locks the gift: wishlist
 * before gift, the order every mutation locks in, so a gift edit cannot deadlock against a
 * reorder or priority and category restructuring of the same wishlist.
 */
async function lockManagedGift(
	transaction: DatabaseTransaction,
	actorUserId: string,
	giftId: string,
): Promise<{ giftRow: GiftRow; managedWishlist: ManagedWishlist }> {
	const activeGift = and(eq(gift.id, giftId), isNull(gift.deletedAt));
	const [unlockedGift] = await transaction
		.select({ wishlistId: gift.wishlistId })
		.from(gift)
		.where(activeGift)
		.limit(1);
	if (unlockedGift === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	const managedWishlist = await requireWishlistManagement(
		transaction,
		actorUserId,
		unlockedGift.wishlistId,
		{ lock: KEY_SHARE_WISHLIST_LOCK },
	);
	assertWishlistMutable(managedWishlist.wishlistRow);
	// Re-checked under the lock: the gift may have been deleted while the wishlist lock was awaited.
	const [giftRow] = await transaction
		.select()
		.from(gift)
		.where(and(activeGift, eq(gift.wishlistId, unlockedGift.wishlistId)))
		.for('update');
	if (giftRow === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}
	return { giftRow, managedWishlist };
}

/** A new gift's categories from either the list or the superseded single `categoryId`. */
function withCreationCategoryIds({ categoryId, ...input }: CreateGiftInput) {
	return { ...input, categoryIds: requestedGiftCategoryIds({ ...input, categoryId }, []) };
}

export const createGiftOperation = defineOperation({
	name: 'createGift',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: CreateGiftInputSchema,
	async run(context, input) {
		const { wishlistRow } = await requireWishlistManagement(
			context.transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: false },
		);
		assertWishlistMutable(wishlistRow);

		let created: GiftRow | undefined;
		try {
			[created] = await appendGiftsUsingTransaction(
				context.transaction,
				{
					wishlistId: input.wishlistId,
					actorId: context.actor.userId,
					gifts: [withCreationCategoryIds(input)],
					recordRevisions: context.recordGiftRevisions,
				},
				context.now,
			);
		} catch (thrown) {
			mapGiftCreationError(thrown);
		}
		if (created === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
		}
		return { gift: created, wishlistShortId: wishlistRow.shortId };
	},
});

export const updateGiftOperation = defineOperation({
	name: 'updateGift',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: UpdateGiftInputSchema,
	async run(context, input) {
		rejectDemoGiftImages([input]);
		const { giftRow, managedWishlist } = await lockManagedGift(
			context.transaction,
			context.actor.userId,
			input.id,
		);
		const { updated, didCategoryChange } = await applyGiftUpdate(context, {
			giftRow,
			managedWishlist,
			input,
		});
		return {
			gift: updated,
			wishlistId: giftRow.wishlistId,
			wishlistShortId: managedWishlist.wishlistRow.shortId,
			didCategoryChange,
		};
	},
});

/**
 * Adds text to a gift's description. On a shared wishlist the text becomes a new timestamped
 * segment for every manager, keeping the original description frozen for gifters; on a draft, or
 * for a gift exempt from the strict post-share rules, it simply extends the description.
 */
export const appendGiftDescriptionOperation = defineOperation({
	name: 'appendGiftDescription',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({
		giftId: v.string(),
		text: v.pipe(v.string(), v.trim(), v.minLength(1)),
	}),
	async run(context, input) {
		const { giftRow, managedWishlist } = await lockManagedGift(
			context.transaction,
			context.actor.userId,
			input.giftId,
		);
		const { wishlistRow } = managedWishlist;
		const appendsSegment =
			wishlistRow.sharedAt !== null &&
			(await lockedGiftFollowsStrictPostShareRules(
				context.transaction,
				wishlistRow,
				giftRow.id,
			));
		const currentDescription = giftRow.description?.trim() ?? '';
		const description =
			appendsSegment || currentDescription === ''
				? input.text
				: `${currentDescription}\n\n${input.text}`;
		const { updated } = await applyGiftUpdate(context, {
			giftRow,
			managedWishlist,
			input: { id: giftRow.id, description },
			appendsDescription: true,
		});
		return { gift: updated, wishlistShortId: managedWishlist.wishlistRow.shortId };
	},
});

export const deleteGiftOperation = defineOperation({
	name: 'deleteGift',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ giftId: v.string() }),
	async run(context, input) {
		const { giftRow, managedWishlist } = await lockManagedGift(
			context.transaction,
			context.actor.userId,
			input.giftId,
		);
		await softDeleteGift(context, giftRow, managedWishlist);
		return {
			wishlistId: giftRow.wishlistId,
			wishlistShortId: managedWishlist.wishlistRow.shortId,
		};
	},
});

/** A management action: the recipient marks their own gifts, a správce does it on their behalf. */
export const markGiftReceivedOperation = defineOperation({
	name: 'markGiftReceived',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: MarkGiftReceivedInputSchema,
	async run(context, input) {
		const { giftRow, managedWishlist } = await lockManagedGift(
			context.transaction,
			context.actor.userId,
			input.giftId,
		);
		const [updated] = await context.transaction
			.update(gift)
			.set({ received: input.received, updatedAt: context.now })
			.where(eq(gift.id, input.giftId))
			.returning();
		if (updated !== undefined) {
			context.recordGiftRevisions([
				{
					giftId: giftRow.id,
					wishlistId: giftRow.wishlistId,
					before: giftRow,
					after: updated,
				},
			]);
		}
		return { gift: updated, wishlistShortId: managedWishlist.wishlistRow.shortId };
	},
});
