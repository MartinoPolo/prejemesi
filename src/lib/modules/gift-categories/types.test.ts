import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
	SaveGiftCategorySettingsInputSchema,
	occupiedGiftCategoryLabels,
	resolveCategoryLabel,
} from './types.js';

describe('SaveGiftCategorySettingsInputSchema', () => {
	it.each(['#12345', '#1234567', '123456', '#GG0000', '#abc'])(
		'rejects non-six-digit color %s',
		(color) => {
			const result = v.safeParse(SaveGiftCategorySettingsInputSchema, {
				wishlistId: 'wishlist-1',
				categories: [{ id: null, label: 'Sport', color }],
				confirmedRemovalCategoryIds: [],
			});
			expect(result.success).toBe(false);
		},
	);

	it('accepts the ordered category list with trimmed labels', () => {
		const input = v.parse(SaveGiftCategorySettingsInputSchema, {
			wishlistId: 'wishlist-1',
			categories: [
				{ id: 'books-row', label: 'Knihy', color: '#2563EB' },
				{ id: null, label: '  Sport  ', color: '#12aBcF' },
			],
			confirmedRemovalCategoryIds: [],
		});
		expect(input.categories?.[1]?.label).toBe('Sport');
	});

	it('still accepts the legacy split payload of custom and preset categories', () => {
		const result = v.safeParse(SaveGiftCategorySettingsInputSchema, {
			wishlistId: 'wishlist-1',
			customCategories: [{ id: null, label: 'Sport', color: '#12aBcF' }],
			presetKeys: ['books'],
			presetColors: [{ key: 'books', color: '#2563EB' }],
			confirmedRemovalCategoryIds: [],
		});
		expect(result.success).toBe(true);
	});

	it('requires the explicit category IDs confirmed for removal', () => {
		const result = v.safeParse(SaveGiftCategorySettingsInputSchema, {
			wishlistId: 'wishlist-1',
			categories: [],
		});

		expect(result.success).toBe(false);
	});
});

describe('occupiedGiftCategoryLabels', () => {
	it('claims both locale labels for an unrenamed preset', () => {
		expect(occupiedGiftCategoryLabels({ presetKey: 'games', customLabel: null })).toEqual([
			'hry',
			'games',
		]);
	});

	it('claims only the normalized custom label for a custom or renamed category', () => {
		expect(occupiedGiftCategoryLabels({ presetKey: null, customLabel: '  Hračky ' })).toEqual([
			'hracky',
		]);
	});
});

describe('resolveCategoryLabel', () => {
	const categories = [
		{
			id: 'games',
			presetKey: 'games' as const,
			customLabel: null,
			color: '#7C3AED',
			sortOrder: 0,
		},
		{ id: 'custom', presetKey: null, customLabel: 'Knihy', color: '#2563EB', sortOrder: 1 },
	];

	it('matches a preset by either locale label and a custom category by its label', () => {
		expect(resolveCategoryLabel('GAMES', categories)).toEqual({
			kind: 'preset',
			presetKey: 'games',
			categoryId: 'games',
		});
		expect(resolveCategoryLabel('knihy', categories)).toEqual({
			kind: 'custom',
			categoryId: 'custom',
		});
		expect(resolveCategoryLabel('Books', categories)).toBeNull();
	});
});
