import { describe, expect, it } from 'vitest';
import { GIFT_CARD_COLUMN_OPTIONS } from '$lib/modules/gifts/types.js';
import {
	isGiftCardColumnOptionAvailable,
	largestFittingGiftCardColumnCount,
} from './gift_card_grid_columns.js';

/** Smallest step between layout widths: browsers snap layout to 1/64px. */
const LAYOUT_UNIT = 1 / 64;

describe('largestFittingGiftCardColumnCount', () => {
	it.each([
		{ collectionWidth: 1168, expected: 5 },
		{ collectionWidth: 1160, expected: 5 },
		{ collectionWidth: 1160 - LAYOUT_UNIT, expected: 4 },
		{ collectionWidth: 924, expected: 4 },
		{ collectionWidth: 924 - LAYOUT_UNIT, expected: 3 },
		{ collectionWidth: 688, expected: 3 },
		{ collectionWidth: 216, expected: 1 },
		{ collectionWidth: 120, expected: 1 },
	])(
		'fits $expected gap-separated 216px cards into $collectionWidth px',
		({ collectionWidth, expected }) => {
			expect(
				largestFittingGiftCardColumnCount({
					collectionWidth,
					columnGap: 20,
					minimumCardWidth: 216,
				}),
			).toBe(expected);
		},
	);

	it('keeps an exactly fitting count despite floating-point division', () => {
		// 13.5rem cards and the 1.25rem desktop gap at a 16.1px root font size.
		const minimumCardWidth = 13.5 * 16.1;
		const columnGap = 1.25 * 16.1;
		const exactFiveColumnWidth = 5 * minimumCardWidth + 4 * columnGap;
		expect(
			largestFittingGiftCardColumnCount({
				collectionWidth: exactFiveColumnWidth,
				columnGap,
				minimumCardWidth,
			}),
		).toBe(5);
	});
});

describe('isGiftCardColumnOptionAvailable', () => {
	it('always offers Automatic', () => {
		expect(isGiftCardColumnOptionAvailable(GIFT_CARD_COLUMN_OPTIONS.automatic, 1)).toBe(true);
	});

	it.each([
		{ capacity: 5, four: true, five: true },
		{ capacity: 4, four: true, five: false },
		{ capacity: 3, four: false, five: false },
	])('offers only counts that fit a capacity of $capacity', ({ capacity, four, five }) => {
		expect(isGiftCardColumnOptionAvailable(GIFT_CARD_COLUMN_OPTIONS.four, capacity)).toBe(four);
		expect(isGiftCardColumnOptionAvailable(GIFT_CARD_COLUMN_OPTIONS.five, capacity)).toBe(five);
	});

	it('keeps chosen counts available while the collection is unmeasured', () => {
		expect(isGiftCardColumnOptionAvailable(GIFT_CARD_COLUMN_OPTIONS.five, null)).toBe(true);
	});
});
