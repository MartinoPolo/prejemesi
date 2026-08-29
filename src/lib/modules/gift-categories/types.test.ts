import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { SaveGiftCategorySettingsInputSchema } from './types.js';

describe('SaveGiftCategorySettingsInputSchema', () => {
	it.each(['#12345', '#1234567', '123456', '#GG0000', '#abc'])(
		'rejects non-six-digit color %s',
		(color) => {
			const result = v.safeParse(SaveGiftCategorySettingsInputSchema, {
				wishlistId: 'wishlist-1',
				customCategories: [{ id: null, label: 'Sport', color }],
				presetKeys: [],
				presetColors: [],
				confirmedRemovalCategoryIds: [],
			});
			expect(result.success).toBe(false);
		},
	);

	it('accepts a complete settings payload containing custom and preset colors', () => {
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
			customCategories: [],
			presetKeys: [],
		});

		expect(result.success).toBe(false);
	});
});
