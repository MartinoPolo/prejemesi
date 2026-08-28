import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { SaveGiftCategorySettingsInputSchema } from './types.js';

describe('SaveGiftCategorySettingsInputSchema', () => {
	it('requires the explicit category IDs confirmed for removal', () => {
		const result = v.safeParse(SaveGiftCategorySettingsInputSchema, {
			wishlistId: 'wishlist-1',
			customCategories: [],
			presetKeys: [],
		});

		expect(result.success).toBe(false);
	});
});
