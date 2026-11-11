import {
	GIFT_GROUPING_OPTIONS,
	GIFT_VIEW_MODES,
	type GiftGroupingOption,
	type GiftViewMode,
} from './types.js';

/**
 * The view a saved preference renders as. Carousel exists on mobile only, and reorder and
 * selection modes show it as Card; neither case rewrites the saved preference.
 */
export function presentedGiftViewMode(
	savedViewMode: GiftViewMode,
	{ narrowViewport, temporaryCardView }: { narrowViewport: boolean; temporaryCardView: boolean },
): GiftViewMode {
	if (savedViewMode !== GIFT_VIEW_MODES.carousel) {
		return savedViewMode;
	}
	return narrowViewport && !temporaryCardView ? GIFT_VIEW_MODES.carousel : GIFT_VIEW_MODES.card;
}

/**
 * The Carousel always groups: it keeps a priority or category grouping, otherwise groups by
 * priority when any gift has one, then by category. A list with neither stays one row.
 */
export function carouselGrouping(
	grouping: GiftGroupingOption,
	availability: { priority: boolean; category: boolean },
): GiftGroupingOption {
	if (grouping !== GIFT_GROUPING_OPTIONS.none) {
		return grouping;
	}
	if (availability.priority) {
		return GIFT_GROUPING_OPTIONS.priority;
	}
	return availability.category ? GIFT_GROUPING_OPTIONS.category : GIFT_GROUPING_OPTIONS.none;
}
