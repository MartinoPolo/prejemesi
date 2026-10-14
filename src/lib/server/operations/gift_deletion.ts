import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { isOwnerSharedGiftDeleteGraceOpen } from '$lib/modules/gifts/gift_deletion_rules.js';
import type { MutationOperationContext } from './operation.js';
import type { GiftRow } from './gift_update.js';
import type { ManagedWishlist } from './wishlist_management.js';

/**
 * Soft-deletes a gift under the deletion rules: on a shared wishlist the recipient may delete only
 * within the share grace (pre-share gift) or creation grace (post-share gift), and nobody deletes a
 * reserved gift. Správci see reservation state, so they are exempt from the grace limits.
 */
export async function softDeleteGift(
	context: MutationOperationContext,
	giftRow: GiftRow,
	managedWishlist: ManagedWishlist,
): Promise<void> {
	const { transaction, now } = context;
	const { role, wishlistRow } = managedWishlist;
	if (role === WISHLIST_ROLES.recipient && wishlistRow.sharedAt !== null) {
		const deleteGraceOpen = isOwnerSharedGiftDeleteGraceOpen(
			{ wishlistSharedAt: wishlistRow.sharedAt, giftCreatedAt: giftRow.createdAt },
			now,
		);
		if (!deleteGraceOpen) {
			error(403, SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING);
		}
	}

	const [activeReservation] = await transaction
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftRow.id), isNull(reservation.deletedAt)))
		.limit(1);
	if (activeReservation !== undefined) {
		error(400, SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT);
	}

	await transaction
		.update(gift)
		.set({ deletedAt: now, updatedAt: now })
		.where(eq(gift.id, giftRow.id));
	context.recordGiftRevisions([
		{
			giftId: giftRow.id,
			wishlistId: giftRow.wishlistId,
			before: giftRow,
			after: { ...giftRow, deletedAt: now },
		},
	]);

	// Storage cleanup (issue #107): the uploaded image is unreachable once the gift is deleted.
	const deletedImageKey = giftRow.imageKey;
	context.deferEffect(() => deleteObjectsBestEffort([deletedImageKey]));
}
