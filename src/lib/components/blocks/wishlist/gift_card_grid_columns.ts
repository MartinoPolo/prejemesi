import { GIFT_CARD_COLUMN_OPTIONS, type GiftCardColumnOption } from '$lib/modules/gifts/types.js';

/**
 * Narrowest desktop card whose footer still fits the widest single primary action, More, their
 * gap, and the footer insets with Ink/Black depth clearance. Rem keeps it proportional to the
 * root font size; `gift_card_minimum_width.svelte.test.ts` holds the measured evidence.
 */
export const GIFT_CARD_MINIMUM_WIDTH_REM = 13.5;
export const GIFT_CARD_MINIMUM_WIDTH = `${GIFT_CARD_MINIMUM_WIDTH_REM}rem`;

const GIFT_CARD_CHOSEN_COLUMN_COUNTS = {
	four: 4,
	five: 5,
} as const satisfies Record<
	Exclude<GiftCardColumnOption, typeof GIFT_CARD_COLUMN_OPTIONS.automatic>,
	number
>;

// Browsers snap layout widths to 1/64px (Firefox 1/60px). A smaller tolerance only absorbs
// floating-point division error, so it never reports a count the CSS grid template would drop.
const FIT_TOLERANCE_PX = 0.01;

export interface GiftCardGridGeometry {
	collectionWidth: number;
	columnGap: number;
	minimumCardWidth: number;
}

/** Column count fixed by the option, or undefined for the responsive Automatic layout. */
export function giftCardChosenColumnCount(option: GiftCardColumnOption): number | undefined {
	return option === GIFT_CARD_COLUMN_OPTIONS.automatic
		? undefined
		: GIFT_CARD_CHOSEN_COLUMN_COUNTS[option];
}

/**
 * Largest number of gap-separated columns whose cards are at least the minimum card width; the
 * same rule decides how many columns the chosen-count grid template renders.
 */
export function largestFittingGiftCardColumnCount({
	collectionWidth,
	columnGap,
	minimumCardWidth,
}: GiftCardGridGeometry): number {
	return Math.max(
		1,
		Math.floor(
			(collectionWidth + columnGap + FIT_TOLERANCE_PX) / (minimumCardWidth + columnGap),
		),
	);
}

/**
 * An unknown capacity keeps every option available because the grid template itself falls back
 * to the largest fitting count.
 */
export function isGiftCardColumnOptionAvailable(
	option: GiftCardColumnOption,
	largestFittingColumnCount: number | null,
): boolean {
	const chosenColumnCount = giftCardChosenColumnCount(option);
	return (
		chosenColumnCount === undefined ||
		largestFittingColumnCount === null ||
		chosenColumnCount <= largestFittingColumnCount
	);
}

export function measureGiftCardGridGeometry(grid: HTMLElement): GiftCardGridGeometry {
	const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
	return {
		// Fractional, unlike clientWidth, whose rounding up would report a column the grid drops.
		collectionWidth: grid.getBoundingClientRect().width,
		columnGap: Number.parseFloat(getComputedStyle(grid).columnGap) || 0,
		minimumCardWidth: GIFT_CARD_MINIMUM_WIDTH_REM * rootFontSize,
	};
}
