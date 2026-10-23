import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { saveWishlistSettingsOperation } from '$lib/server/operations/wishlist_detail_operations.js';
import { getGiftCategories } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { getWishlistByShortId } from './wishlists.remote.js';
import { SaveWishlistSettingsInputSchema } from './wishlist_settings_types.js';

export const saveWishlistSettings = guardedCommand(
	SaveWishlistSettingsInputSchema,
	async ({ user }, input) => {
		const { wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			saveWishlistSettingsOperation,
			input,
		);
		void singleFlightRefresh(getWishlistByShortId, wishlistShortId);
		if (input.categories !== undefined) {
			void singleFlightRefresh(getGiftCategories, input.wishlistId);
			void singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
		}
	},
);
