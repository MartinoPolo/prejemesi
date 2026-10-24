/** Most categories one gift carries; the database enforces it with `gift_category_ids_limit_check`. */
export const MAX_GIFT_CATEGORIES = 5;

/** The category that category grouping and reorder groups use: the first of the gift's list. */
export function primaryGiftCategoryId(categoryIds: readonly string[]): string | null {
	return categoryIds[0] ?? null;
}

/** Whether a list names each category once and fits the per-gift limit. */
export function isValidGiftCategoryIdList(categoryIds: readonly string[]): boolean {
	return (
		categoryIds.length <= MAX_GIFT_CATEGORIES &&
		new Set(categoryIds).size === categoryIds.length
	);
}

/**
 * Replaces only the primary category: the new one leads and the others keep their order, losing a
 * duplicate of it. `null` drops the primary, so the next category becomes primary.
 */
export function withPrimaryGiftCategory(
	categoryIds: readonly string[],
	primaryCategoryId: string | null,
): string[] {
	const others = categoryIds.slice(1).filter((categoryId) => categoryId !== primaryCategoryId);
	return primaryCategoryId === null ? others : [primaryCategoryId, ...others];
}

/** Appends a category the gift lacks; a gift already at the limit stays unchanged. */
export function withGiftCategoryAdded(
	categoryIds: readonly string[],
	categoryId: string,
): string[] {
	if (categoryIds.includes(categoryId) || categoryIds.length >= MAX_GIFT_CATEGORIES) {
		return [...categoryIds];
	}
	return [...categoryIds, categoryId];
}

export function withGiftCategoryRemoved(
	categoryIds: readonly string[],
	categoryId: string,
): string[] {
	return categoryIds.filter((candidate) => candidate !== categoryId);
}

/** A category checkbox toggle: checking adds the category, unchecking removes it. */
export function withGiftCategoryToggled(
	categoryIds: readonly string[],
	categoryId: string,
	checked: boolean,
): string[] {
	return checked
		? withGiftCategoryAdded(categoryIds, categoryId)
		: withGiftCategoryRemoved(categoryIds, categoryId);
}

export function sameGiftCategoryIds(first: readonly string[], second: readonly string[]): boolean {
	return first.length === second.length && first.every((id, index) => id === second[index]);
}

/**
 * The categories a superseded single-category write means: a category replaces only the primary,
 * so older clients never wipe the others, and `null` still means "no category".
 */
export function giftCategoryIdsFromLegacyCategoryId(
	currentCategoryIds: readonly string[],
	categoryId: string | null,
): string[] {
	return categoryId === null || categoryId === ''
		? []
		: withPrimaryGiftCategory(currentCategoryIds, categoryId);
}

/**
 * The category list an edit asks for: the full `categoryIds` list, or the superseded single
 * `categoryId`. `undefined` leaves the categories unchanged.
 */
export function requestedGiftCategoryIds(
	input: { categoryIds?: readonly string[]; categoryId?: string | null },
	currentCategoryIds: readonly string[],
): string[] | undefined {
	if (input.categoryIds !== undefined) {
		return [...input.categoryIds];
	}
	if (input.categoryId !== undefined) {
		return giftCategoryIdsFromLegacyCategoryId(currentCategoryIds, input.categoryId);
	}
	return undefined;
}

/** A category choice across one or several gifts: all have it, none, or some. */
export type GiftCategoryCheckState = boolean | 'indeterminate';

function checkState(matchingCount: number, totalCount: number): GiftCategoryCheckState {
	if (matchingCount === 0) {
		return false;
	}
	return matchingCount === totalCount ? true : 'indeterminate';
}

/** One checkbox row of a category menu for the given gifts. */
export interface GiftCategoryChoice {
	state: GiftCategoryCheckState;
	/** Whether checking can add the category to any gift that lacks it and has room left. */
	addable: boolean;
}

/** The category menu's checkbox states for the given gifts' category lists. */
export function giftCategoryChoices(
	categoryLists: readonly (readonly string[])[],
	categoryIds: readonly string[],
): { categories: Map<string, GiftCategoryChoice>; uncategorized: GiftCategoryCheckState } {
	const categories = new Map<string, GiftCategoryChoice>();
	for (const categoryId of categoryIds) {
		const holders = categoryLists.filter((list) => list.includes(categoryId)).length;
		categories.set(categoryId, {
			state: checkState(holders, categoryLists.length),
			addable: categoryLists.some(
				(list) => !list.includes(categoryId) && list.length < MAX_GIFT_CATEGORIES,
			),
		});
	}
	return {
		categories,
		uncategorized: checkState(
			categoryLists.filter((list) => list.length === 0).length,
			categoryLists.length,
		),
	};
}
