import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import { saveGiftCategorySettingsOperation } from '$lib/server/operations/gift_grouping_operations.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { SaveGiftCategorySettingsInputSchema } from './types.js';
import { getGiftCategories, getGiftCategorySettingsRows } from './gift_category_queries.remote.js';

export const saveGiftCategorySettingsCommand = guardedCommand(
	SaveGiftCategorySettingsInputSchema,
	async ({ user }, input) => {
		const { wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			saveGiftCategorySettingsOperation,
			input,
		);
		void singleFlightRefresh(getGiftCategories, input.wishlistId);
		void singleFlightRefresh(getGiftCategorySettingsRows, input.wishlistId);
		void singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	},
);
