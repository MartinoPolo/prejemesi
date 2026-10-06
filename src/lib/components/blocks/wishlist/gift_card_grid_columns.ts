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

// Absorbs floating-point error so a collection that fits a count exactly keeps that count.
const FIT_TOLERANCE_PX = 0.01;

export interface GiftCardGridGeometry {
	collectionWidth: number;
	columnGap: number;
	minimumCardWidth: number;
}

/** Largest number of gap-separated columns whose cards are at least the minimum card width. */
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
	return (
		option === GIFT_CARD_COLUMN_OPTIONS.automatic ||
		largestFittingColumnCount === null ||
		GIFT_CARD_CHOSEN_COLUMN_COUNTS[option] <= largestFittingColumnCount
	);
}

export function measureGiftCardGridGeometry(grid: HTMLElement): GiftCardGridGeometry {
	const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
	return {
		collectionWidth: grid.clientWidth,
		columnGap: Number.parseFloat(getComputedStyle(grid).columnGap) || 0,
		minimumCardWidth: GIFT_CARD_MINIMUM_WIDTH_REM * rootFontSize,
	};
}
