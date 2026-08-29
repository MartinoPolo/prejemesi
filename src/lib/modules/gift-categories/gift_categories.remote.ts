import * as v from 'valibot';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
} from '$lib/modules/wishlists/wishlist_access.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { SaveGiftCategorySettingsInputSchema } from './types.js';
import {
	getManagedGiftCategories,
	getManagedGiftCategorySettingsRows,
	saveGiftCategorySettings,
} from './gift_categories_service.js';

export const getGiftCategories = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	await verifyManagerAccess(user.id, wishlistId);
	return getManagedGiftCategories(wishlistId);
});

export const getGiftCategorySettingsRows = guardedQueryWithArgs(
	v.string(),
	async ({ user }, wishlistId) => {
		await verifyManagerAccess(user.id, wishlistId);
		return getManagedGiftCategorySettingsRows(wishlistId);
	},
);

export const saveGiftCategorySettingsCommand = guardedCommand(
	SaveGiftCategorySettingsInputSchema,
	async ({ user }, input) => {
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);
		await saveGiftCategorySettings(input);
		await Promise.all([
			singleFlightRefresh(getGiftCategories, input.wishlistId),
			singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId),
			singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId),
		]);
	},
);
