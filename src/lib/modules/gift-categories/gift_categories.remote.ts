import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { giftCategory } from '$lib/server/db/gift.schema.js';
import { guardedCommand, guardedQueryWithArgs, singleFlightRefresh } from '$lib/server/remote.js';
import {
	verifyManagerAccess,
	assertWishlistMutable,
} from '$lib/modules/wishlists/wishlist_access.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CategoryIdInputSchema,
	CreateCustomGiftCategoryInputSchema,
	RenameCustomGiftCategoryInputSchema,
	ReorderGiftCategoriesInputSchema,
	TogglePresetGiftCategoryInputSchema,
} from './types.js';
import {
	createCustomGiftCategory,
	deleteCustomGiftCategory,
	enablePresetGiftCategory,
	getManagedGiftCategories,
	renameCustomGiftCategory,
	reorderActiveGiftCategories,
} from './gift_categories_service.js';

export const getGiftCategories = guardedQueryWithArgs(v.string(), async ({ user }, wishlistId) => {
	await verifyManagerAccess(user.id, wishlistId);
	return getManagedGiftCategories(wishlistId);
});

export const togglePresetGiftCategory = guardedCommand(
	TogglePresetGiftCategoryInputSchema,
	async ({ user }, input) => {
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);
		await enablePresetGiftCategory(input);
		singleFlightRefresh(getGiftCategories, input.wishlistId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
	},
);

export const createCustomGiftCategoryCommand = guardedCommand(
	CreateCustomGiftCategoryInputSchema,
	async ({ user }, input) => {
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);
		const created = await createCustomGiftCategory(input);
		singleFlightRefresh(getGiftCategories, input.wishlistId);
		return created;
	},
);

export const renameCustomGiftCategoryCommand = guardedCommand(
	RenameCustomGiftCategoryInputSchema,
	async ({ user }, input) => {
		const category = await getCategory(input.categoryId);
		const { wishlistRow } = await verifyManagerAccess(user.id, category.wishlistId);
		assertWishlistMutable(wishlistRow);
		await renameCustomGiftCategory(input);
		singleFlightRefresh(getGiftCategories, category.wishlistId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
	},
);

export const deleteCustomGiftCategoryCommand = guardedCommand(
	CategoryIdInputSchema,
	async ({ user }, input) => {
		const category = await getCategory(input.categoryId);
		const { wishlistRow } = await verifyManagerAccess(user.id, category.wishlistId);
		assertWishlistMutable(wishlistRow);
		await deleteCustomGiftCategory(input.categoryId);
		singleFlightRefresh(getGiftCategories, category.wishlistId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
	},
);

export const reorderGiftCategories = guardedCommand(
	ReorderGiftCategoriesInputSchema,
	async ({ user }, input) => {
		const { wishlistRow } = await verifyManagerAccess(user.id, input.wishlistId);
		assertWishlistMutable(wishlistRow);
		await reorderActiveGiftCategories(input);
		singleFlightRefresh(getGiftCategories, input.wishlistId);
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);
	},
);

async function getCategory(categoryId: string) {
	const [category] = await getDb()
		.select()
		.from(giftCategory)
		.where(eq(giftCategory.id, categoryId))
		.limit(1);
	if (category === undefined) {
		error(404, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
	}
	return category;
}
