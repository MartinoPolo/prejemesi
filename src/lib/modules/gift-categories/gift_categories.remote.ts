import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { userInterfaceActor } from '$lib/server/operations/actor.js';
import { executeOperation } from '$lib/server/operations/runner.js';
import {
	createGiftCategoryOperation,
	saveGiftCategorySettingsOperation,
} from '$lib/server/operations/gift_grouping_operations.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { CreateGiftCategoryInputSchema, SaveGiftCategorySettingsInputSchema } from './types.js';
import { getGiftCategories } from './gift_category_queries.remote.js';

export const saveGiftCategorySettingsCommand = guardedCommand(
	SaveGiftCategorySettingsInputSchema,
	async ({ user }, input) => {
		const { wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			saveGiftCategorySettingsOperation,
			input,
		);
		void singleFlightRefresh(getGiftCategories, input.wishlistId);
		void singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	},
);

export const createGiftCategoryCommand = guardedCommand(
	CreateGiftCategoryInputSchema,
	async ({ user }, input) => {
		const { category, wishlistShortId } = await executeOperation(
			userInterfaceActor(user),
			createGiftCategoryOperation,
			input,
		);
		void singleFlightRefresh(getGiftCategories, input.wishlistId);
		if (input.giftIds.length > 0) {
			void singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
		}
		return category;
	},
);
