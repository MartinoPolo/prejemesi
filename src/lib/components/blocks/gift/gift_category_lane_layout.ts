/** Below this width a shrunk primary category is unreadable beside "+X" (design brief #529). */
export const PRIMARY_CATEGORY_READABLE_WIDTH_REM = 5;

// Sub-pixel badge widths can round either way; a lane this much too narrow still fits.
const FIT_TOLERANCE_PX = 0.5;

export interface CategoryLaneMeasurement {
	laneWidth: number;
	/** Natural one-line widths of the category badges, in the gift's category order. */
	badgeWidths: readonly number[];
	/** Width of the "+X" chip. */
	moreWidth: number;
	gap: number;
	primaryReadableWidth: number;
}

export interface CategoryLaneLayout {
	visibleCount: number;
	/** The primary takes the whole lane and "+X" drops to a second line. */
	moreOnOwnLine: boolean;
}

/**
 * Shows categories in order until the next one no longer fits beside a "+X" chip for the rest;
 * later, narrower categories never skip ahead. The primary is always shown and may shrink.
 */
export function fitCategoryLane(measurement: CategoryLaneMeasurement): CategoryLaneLayout {
	const { laneWidth, badgeWidths, moreWidth, gap, primaryReadableWidth } = measurement;
	const availableWidth = laneWidth + FIT_TOLERANCE_PX;
	const totalWidth =
		badgeWidths.reduce((sum, width) => sum + width, 0) +
		Math.max(0, badgeWidths.length - 1) * gap;
	if (badgeWidths.length <= 1 || totalWidth <= availableWidth) {
		return { visibleCount: badgeWidths.length, moreOnOwnLine: false };
	}

	let visibleCount = 0;
	let usedWidth = 0;
	for (const width of badgeWidths) {
		const nextUsedWidth = usedWidth + width + gap;
		if (nextUsedWidth + moreWidth > availableWidth) {
			break;
		}
		usedWidth = nextUsedWidth;
		visibleCount += 1;
	}
	if (visibleCount > 0) {
		return { visibleCount, moreOnOwnLine: false };
	}

	const shrunkPrimaryWidth = laneWidth - gap - moreWidth;
	return { visibleCount: 1, moreOnOwnLine: shrunkPrimaryWidth < primaryReadableWidth };
}
