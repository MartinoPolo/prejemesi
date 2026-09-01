import { describe, expect, it } from 'vitest';
import {
	CUSTOM_GIFT_CATEGORY_COLORS,
	contrastRatio,
	foregroundForCategoryColor,
	giftCategoryColorForIndex,
} from './gift_category_colors.js';
import { GIFT_CATEGORY_PRESETS } from './presets.js';

const HEX_COLOR = /^#[0-9A-F]{6}$/;

describe('gift category colors', () => {
	it('gives every preset an exact distinct valid curated color', () => {
		expect(GIFT_CATEGORY_PRESETS.map(({ key, color }) => [key, color])).toEqual([
			['games', '#7C3AED'],
			['toys', '#D97706'],
			['books', '#2563EB'],
			['clothing', '#DB2777'],
			['electronics', '#0F766E'],
			['home', '#B45309'],
			['experiences', '#15803D'],
			['subscriptions', '#6D28D9'],
			['personal-care', '#BE185D'],
		]);
		const colors = GIFT_CATEGORY_PRESETS.map(({ color }) => color);
		expect(colors.every((color) => HEX_COLOR.test(color))).toBe(true);
		expect(new Set(colors).size).toBe(colors.length);
	});

	it('provides exactly 20 distinct valid custom color presets including key neutrals', () => {
		expect(CUSTOM_GIFT_CATEGORY_COLORS).toHaveLength(20);
		expect(CUSTOM_GIFT_CATEGORY_COLORS.every((color) => HEX_COLOR.test(color))).toBe(true);
		expect(new Set(CUSTOM_GIFT_CATEGORY_COLORS).size).toBe(20);
		expect(CUSTOM_GIFT_CATEGORY_COLORS).toEqual(
			expect.arrayContaining(['#92400E', '#FACC15', '#000000', '#FFFFFF']),
		);
	});

	it('preserves the original deterministic custom defaults after the picker expands', () => {
		const originalDefaults = [
			'#0369A1',
			'#047857',
			'#A21CAF',
			'#C2410C',
			'#4F46E5',
			'#B91C1C',
			'#0F766E',
			'#7E22CE',
		];
		expect(originalDefaults.map((_, index) => giftCategoryColorForIndex(index))).toEqual(
			originalDefaults,
		);
		expect(giftCategoryColorForIndex(originalDefaults.length)).toBe(originalDefaults[0]);
	});

	it.each(['#000000', '#FFFFFF', '#777777'])('%s gets black or white text at 4.5:1', (color) => {
		const foreground = foregroundForCategoryColor(color);
		expect(['#000000', '#FFFFFF']).toContain(foreground);
		expect(contrastRatio(color, foreground)).toBeGreaterThanOrEqual(4.5);
	});
});
