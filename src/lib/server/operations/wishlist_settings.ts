import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { rejectDemoImageUpload } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { saveGiftCategorySettings } from '$lib/modules/gift-categories/gift_categories_service.js';
import { wishlistBackgroundImageKey } from '$lib/modules/wishlists/wishlist_appearance.js';
import type { SaveWishlistSettingsInput } from '$lib/modules/wishlists/wishlist_settings_types.js';
import type { MutationOperationContext } from './operation.js';
import { requireMutableManagedWishlist, type WishlistRow } from './wishlist_management.js';
import {
	authorizeWishlistUploadReplacement,
	planWishlistDetailEdit,
} from './wishlist_edit_rules.js';

type AppearanceInput = NonNullable<SaveWishlistSettingsInput['appearance']>;

/** The image key a background draft requests: undefined keeps the stored upload. */
function requestedBackgroundImageKey(appearance: AppearanceInput): string | null | undefined {
	return appearance.background === null ? null : appearance.background.imageKey;
}

/** Only explicit choices are stored, so an empty override set reads like no override. */
function planAppearanceEdit(
	wishlistRow: WishlistRow,
	appearance: AppearanceInput | undefined,
): Partial<WishlistRow> {
	if (appearance === undefined) {
		return {};
	}
	const { styleTokens, background } = appearance;
	return {
		themeId: appearance.themeId,
		styleTokens:
			styleTokens === null || Object.keys(styleTokens).length === 0 ? null : styleTokens,
		background:
			background === null
				? null
				: {
						...background,
						imageKey:
							background.imageKey === undefined
								? wishlistBackgroundImageKey(wishlistRow.background)
								: background.imageKey,
					},
	};
}

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
		...planAppearanceEdit(wishlistRow, input.appearance),
	};
}

/** The stored custom background this save replaces or clears, after checking a new key's proof. */
function authorizeBackgroundReplacement(
	actorUserId: string,
	wishlistRow: WishlistRow,
	appearance: AppearanceInput | undefined,
): Promise<string | null> {
	if (appearance === undefined) {
		return Promise.resolve(null);
	}
	const storedBackgroundKey = wishlistBackgroundImageKey(wishlistRow.background);
	return authorizeWishlistUploadReplacement(
		actorUserId,
		storedBackgroundKey,
		{
			imageKey: requestedBackgroundImageKey(appearance),
			assignmentToken: appearance.backgroundAssignmentToken,
		},
		'wishlist-background',
	);
}

/**
 * Locks and revalidates the mutable wishlist, then saves every settings domain inside the batch
 * transaction. Returns the image keys this batch actually replaced so cleanup cannot race a later
 * save.
 */
export async function saveLockedWishlistSettings(
	context: MutationOperationContext,
	input: SaveWishlistSettingsInput,
): Promise<{ replacedImageKeys: string[]; shortId: string }> {
	rejectDemoImageUpload(input.image?.imageKey);
	rejectDemoImageUpload(input.appearance?.background?.imageKey);
	const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
		lock: true,
	});
	const replacedBannerKey = await authorizeWishlistUploadReplacement(
		context.actor.userId,
		wishlistRow.imageKey,
		input.image ?? {},
		'wishlist-banner',
	);
	const replacedBackgroundKey = await authorizeBackgroundReplacement(
		context.actor.userId,
		wishlistRow,
		input.appearance,
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
	const replacedImageKeys = [replacedBannerKey, replacedBackgroundKey].filter(
		(imageKey) => imageKey !== null,
	);
	return { replacedImageKeys, shortId: wishlistRow.shortId };
}
