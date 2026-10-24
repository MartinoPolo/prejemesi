import { describe, expect, it } from 'vitest';
import { fitCategoryLane, type CategoryLaneMeasurement } from './gift_category_lane_layout.js';

function measurement(overrides: Partial<CategoryLaneMeasurement>): CategoryLaneMeasurement {
	return {
		laneWidth: 300,
		badgeWidths: [80, 60, 70],
		moreWidth: 30,
		gap: 4,
		primaryReadableWidth: 80,
		...overrides,
	};
}

describe('fitCategoryLane', () => {
	it('shows every category when they all fit on one line', () => {
		expect(fitCategoryLane(measurement({ laneWidth: 218 }))).toEqual({
			visibleCount: 3,
			moreOnOwnLine: false,
		});
	});

	it('shows the leading categories that fit beside "+X" for the rest', () => {
		expect(fitCategoryLane(measurement({ laneWidth: 200 }))).toEqual({
			visibleCount: 2,
			moreOnOwnLine: false,
		});
	});

	it('stops at the first category that does not fit instead of skipping to a narrower one', () => {
		const layout = fitCategoryLane(measurement({ laneWidth: 150, badgeWidths: [80, 120, 10] }));
		expect(layout).toEqual({ visibleCount: 1, moreOnOwnLine: false });
	});

	it('keeps the primary on the line, shrunk, while it stays readable beside "+X"', () => {
		expect(fitCategoryLane(measurement({ laneWidth: 120, badgeWidths: [140, 60] }))).toEqual({
			visibleCount: 1,
			moreOnOwnLine: false,
		});
	});

	it('moves "+X" to its own line when the shrunk primary would be unreadable', () => {
		expect(fitCategoryLane(measurement({ laneWidth: 100, badgeWidths: [140, 60] }))).toEqual({
			visibleCount: 1,
			moreOnOwnLine: true,
		});
	});

	it('shows a single category alone regardless of the lane width', () => {
		expect(fitCategoryLane(measurement({ laneWidth: 40, badgeWidths: [140] }))).toEqual({
			visibleCount: 1,
			moreOnOwnLine: false,
		});
	});
});
