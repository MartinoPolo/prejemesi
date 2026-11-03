import { describe, expect, it } from 'vitest';
import { carouselGrouping, presentedGiftViewMode } from './gift_view_mode.js';
import { GIFT_GROUPING_OPTIONS, GIFT_VIEW_MODES } from './types.js';

describe('presentedGiftViewMode (#580 REQ-1, REQ-8)', () => {
	it('presents a saved Carousel on mobile', () => {
		expect(
			presentedGiftViewMode(GIFT_VIEW_MODES.carousel, {
				narrowViewport: true,
				temporaryCardView: false,
			}),
		).toBe(GIFT_VIEW_MODES.carousel);
	});

	it('presents Card for a saved Carousel on desktop', () => {
		expect(
			presentedGiftViewMode(GIFT_VIEW_MODES.carousel, {
				narrowViewport: false,
				temporaryCardView: false,
			}),
		).toBe(GIFT_VIEW_MODES.card);
	});

	it('presents Card while reorder or selection mode runs over a Carousel', () => {
		expect(
			presentedGiftViewMode(GIFT_VIEW_MODES.carousel, {
				narrowViewport: true,
				temporaryCardView: true,
			}),
		).toBe(GIFT_VIEW_MODES.card);
	});

	it.each([GIFT_VIEW_MODES.card, GIFT_VIEW_MODES.list])(
		'keeps a saved %s in every state',
		(saved) => {
			for (const narrowViewport of [true, false]) {
				for (const temporaryCardView of [true, false]) {
					expect(
						presentedGiftViewMode(saved, { narrowViewport, temporaryCardView }),
					).toBe(saved);
				}
			}
		},
	);
});

describe('carouselGrouping (#580 REQ-3)', () => {
	const everything = { priority: true, category: true };

	it.each([GIFT_GROUPING_OPTIONS.priority, GIFT_GROUPING_OPTIONS.category])(
		'keeps the saved %s grouping',
		(saved) => {
			expect(carouselGrouping(saved, everything)).toBe(saved);
		},
	);

	it('groups by priority without a grouping when any gift has a priority', () => {
		expect(carouselGrouping(GIFT_GROUPING_OPTIONS.none, everything)).toBe(
			GIFT_GROUPING_OPTIONS.priority,
		);
	});

	it('groups by category without a grouping when no gift has a priority', () => {
		expect(
			carouselGrouping(GIFT_GROUPING_OPTIONS.none, { priority: false, category: true }),
		).toBe(GIFT_GROUPING_OPTIONS.category);
	});

	it('shows a single row when no gift has a priority or a category', () => {
		expect(
			carouselGrouping(GIFT_GROUPING_OPTIONS.none, { priority: false, category: false }),
		).toBe(GIFT_GROUPING_OPTIONS.none);
	});
});
