import { getDb } from '$lib/server/db/index.js';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import {
	getGiftCategories,
	getGiftCategorySettingsRows,
} from '$lib/modules/gift-categories/gift_categories.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { verifyManagerAccess, assertWishlistMutable } from './wishlist_access.js';
import { getWishlistByShortId } from './wishlists.remote.js';
import { persistWishlistSettings } from './wishlist_settings_service.js';
import { SaveWishlistSettingsInputSchema } from './wishlist_settings_types.js';

export const saveWishlistSettings = guardedCommand(
	SaveWishlistSettingsInputSchema,
	async ({ user }, input) => {
		const database = getDb();
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);

		await database.transaction((tx) => persistWishlistSettings(tx, wishlistRow, input));

		// R2 cannot participate in the database transaction. Delete the previously persisted
		// object only after commit; the editor owns cleanup of staged, uncommitted uploads.
		if (
			input.image !== undefined &&
			wishlistRow.imageKey !== null &&
			wishlistRow.imageKey !== input.image.imageKey
		) {
			await deleteObjectsBestEffort([wishlistRow.imageKey]);
		}

		void singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);
		if (input.categories !== undefined) {
			void singleFlightRefresh(getGiftCategories, wishlistRow.id);
			void singleFlightRefresh(getGiftCategorySettingsRows, wishlistRow.id);
			void singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
		}
	},
);
