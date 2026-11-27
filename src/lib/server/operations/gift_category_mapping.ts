import type { DatabaseTransaction } from '$lib/server/db/index.js';
import {
	occupiedGiftCategoryLabels,
	type GiftCategoryPresetKey,
	type PublicGiftCategory,
} from '$lib/modules/gift-categories/types.js';
import {
	createCustomGiftCategoryWithDatabase,
	enablePresetGiftCategoryWithDatabase,
	getActiveGiftCategories,
	insertDefaultGiftCategoriesWhenUnset,
} from '$lib/modules/gift-categories/gift_categories_service.js';

/** A category as another wishlist's gift carries it, matched by preset or label. */
export type SourceCategory = Pick<PublicGiftCategory, 'presetKey' | 'customLabel' | 'color'>;

export interface DestinationCategory {
	id: string;
	presetKey: GiftCategoryPresetKey | null;
	customLabel: string | null;
}

/**
 * A preset matches the same preset; otherwise any category claiming the same label matches,
 * because a preset may be renamed into a custom category or recreated as one.
 */
function matchingDestinationCategoryId(
	sourceCategory: SourceCategory,
	destinationCategories: readonly DestinationCategory[],
): string | undefined {
	const sourceLabels = occupiedGiftCategoryLabels(sourceCategory);
	return (
		(sourceCategory.presetKey === null
			? undefined
			: destinationCategories.find(
					(category) => category.presetKey === sourceCategory.presetKey,
				)?.id) ??
		destinationCategories.find((category) =>
			occupiedGiftCategoryLabels(category).some((label) => sourceLabels.includes(label)),
		)?.id
	);
}

/**
 * The copy first adds every category without a match to the destination, so all categories carry
 * over in their order and the primary stays first.
 */
export function matchedCategoryIds(
	sourceCategories: readonly SourceCategory[],
	destinationCategories: readonly DestinationCategory[],
): string[] {
	const categoryIds = new Set<string>();
	for (const sourceCategory of sourceCategories) {
		const destinationCategoryId = matchingDestinationCategoryId(
			sourceCategory,
			destinationCategories,
		);
		if (destinationCategoryId !== undefined) {
			categoryIds.add(destinationCategoryId);
		}
	}
	return [...categoryIds];
}

/**
 * Seeds the destination's default categories when it never had any, then appends each category of
 * the copied gifts that matches none of the destination's: a preset is enabled or restored, a
 * custom category is created with the source label and color. Returns the active categories.
 */
export async function addMissingCopiedCategories(
	transaction: DatabaseTransaction,
	destinationWishlistId: string,
	sourceCategories: readonly SourceCategory[],
): Promise<DestinationCategory[]> {
	await insertDefaultGiftCategoriesWhenUnset(transaction, destinationWishlistId);
	const destinationCategories: DestinationCategory[] = await getActiveGiftCategories(
		destinationWishlistId,
		transaction,
	);
	for (const sourceCategory of sourceCategories) {
		if (matchingDestinationCategoryId(sourceCategory, destinationCategories) !== undefined) {
			continue;
		}
		if (sourceCategory.presetKey !== null) {
			destinationCategories.push(
				await enablePresetGiftCategoryWithDatabase(transaction, {
					wishlistId: destinationWishlistId,
					presetKey: sourceCategory.presetKey,
				}),
			);
		} else if (sourceCategory.customLabel !== null) {
			destinationCategories.push(
				await createCustomGiftCategoryWithDatabase(transaction, {
					wishlistId: destinationWishlistId,
					label: sourceCategory.customLabel,
					color: sourceCategory.color,
				}),
			);
		}
	}
	return destinationCategories;
}

/**
 * The destination wishlist's categories for a gift carrying `sourceCategories` from another
 * wishlist, in their order, mapped like a copy and adding the missing ones.
 */
export async function mapCategoriesIntoWishlist(
	transaction: DatabaseTransaction,
	destinationWishlistId: string,
	sourceCategories: readonly SourceCategory[],
): Promise<string[]> {
	if (sourceCategories.length === 0) {
		return [];
	}
	const destinationCategories = await addMissingCopiedCategories(
		transaction,
		destinationWishlistId,
		sourceCategories,
	);
	return matchedCategoryIds(sourceCategories, destinationCategories);
}
