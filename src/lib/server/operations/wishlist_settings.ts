import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { rejectDemoImageUpload } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { saveGiftCategorySettings } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { SaveWishlistSettingsInput } from '$lib/modules/wishlists/wishlist_settings_types.js';
import type { MutationOperationContext } from './operation.js';
import { requireMutableManagedWishlist, type WishlistRow } from './wishlist_management.js';
import { authorizeBannerReplacement, planWishlistDetailEdit } from './wishlist_edit_rules.js';

/** The wishlist columns a settings draft writes; a linked recipient's name is not editable. */
function planSettingsEdit(
	wishlistRow: WishlistRow,
	input: SaveWishlistSettingsInput,
	now: Date,
): Partial<WishlistRow> {
	const recipientName = input.details?.recipientName;
	if (recipientName !== undefined && wishlistRow.recipientUserId !== null) {
		error(400, SERVER_ERROR.RECIPIENT_RENAME_NOT_ALLOWED);
	}
	return {
		...planWishlistDetailEdit(wishlistRow, { ...input.details, ...input.image }, now),
		...(recipientName === undefined ? {} : { recipientName }),
		...(input.palette === undefined ? {} : { palette: input.palette }),
	};
}

/**
 * Locks and revalidates the mutable wishlist, then saves every settings domain inside the batch
 * transaction. Returns the image key this batch actually replaced so cleanup cannot race a later
 * save.
 */
export async function saveLockedWishlistSettings(
	context: MutationOperationContext,
	input: SaveWishlistSettingsInput,
): Promise<{ replacedImageKey: string | null; shortId: string }> {
	rejectDemoImageUpload(input.image?.imageKey);
	const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
		lock: true,
	});
	const replacedImageKey = await authorizeBannerReplacement(
		context.actor.userId,
		wishlistRow.imageKey,
		input.image ?? {},
	);
	const settingsEdit = planSettingsEdit(wishlistRow, input, context.now);
	if (Object.keys(settingsEdit).length > 0) {
		await context.transaction
			.update(wishlist)
			.set({ ...settingsEdit, updatedAt: context.now })
			.where(eq(wishlist.id, wishlistRow.id));
	}
	if (input.categories !== undefined) {
		await saveGiftCategorySettings(
			{ wishlistId: wishlistRow.id, ...input.categories },
			context,
		);
	}
	return { replacedImageKey, shortId: wishlistRow.shortId };
}
