import type {
	GiftCategoryCheckState,
	GiftCategoryChoice,
} from '$lib/modules/gift-categories/gift_category_assignment.js';

/**
 * The selection toolbar's `categoryChoices` prop: each listed category's state across the
 * selection, addable unless stated otherwise, and the "Bez kategorie" state.
 */
export function selectionCategoryChoices(
	states: Record<string, GiftCategoryCheckState | GiftCategoryChoice>,
	uncategorized: GiftCategoryCheckState = false,
) {
	return {
		categories: new Map<string, GiftCategoryChoice>(
			Object.entries(states).map(([categoryId, choice]) => [
				categoryId,
				typeof choice === 'object' ? choice : { state: choice, addable: true },
			]),
		),
		uncategorized,
	};
}
