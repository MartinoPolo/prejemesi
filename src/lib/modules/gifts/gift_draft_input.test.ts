import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
	CreateGiftInputSchema,
	DEFAULT_DRAFT_PRIORITY,
	GiftDraftInputSchema,
	MAX_GIFT_PRICE,
	UpdateGiftInputSchema,
} from './types.js';

describe('GiftDraftInputSchema phase 4 fields', () => {
	it('accepts an external image URL and positive integer quantity while defaulting them safely', () => {
		const populated = v.parse(GiftDraftInputSchema, {
			name: 'Kniha',
			imageUrl: 'https://images.example.test/book.jpg',
			quantity: 3,
		});
		expect(populated).toMatchObject({
			imageUrl: 'https://images.example.test/book.jpg',
			quantity: 3,
			priority: DEFAULT_DRAFT_PRIORITY,
		});

		const defaults = v.parse(GiftDraftInputSchema, { name: 'Kniha' });
		expect(defaults).toMatchObject({
			imageUrl: null,
			quantity: 1,
			priority: DEFAULT_DRAFT_PRIORITY,
		});
	});

	it('rejects non-HTTPS image URLs at the server validation boundary', () => {
		for (const imageUrl of [
			'http://images.example.test/book.jpg',
			'javascript:alert(1)',
			'not a url',
		]) {
			expect(v.safeParse(GiftDraftInputSchema, { name: 'Kniha', imageUrl }).success).toBe(
				false,
			);
		}
	});

	it('accepts decimal prices through the import wire schema', () => {
		expect(v.parse(GiftDraftInputSchema, { name: 'Kniha', price: 49.9 }).price).toBe(49.9);
		expect(v.parse(GiftDraftInputSchema, { name: 'Kniha', price: 1.29 }).price).toBe(1.29);
	});

	it('rejects overprecision and out-of-range prices in create, draft, and update schemas', () => {
		const cases = [
			[CreateGiftInputSchema, { wishlistId: 'wishlist', name: 'Kniha' }],
			[GiftDraftInputSchema, { name: 'Kniha' }],
			[UpdateGiftInputSchema, { id: 'gift' }],
		] as const;
		for (const [schema, base] of cases) {
			expect(v.safeParse(schema, { ...base, price: 1.001 }).success).toBe(false);
			expect(v.safeParse(schema, { ...base, price: MAX_GIFT_PRICE + 0.01 }).success).toBe(
				false,
			);
			expect(v.safeParse(schema, { ...base, price: Number.POSITIVE_INFINITY }).success).toBe(
				false,
			);
			expect(v.safeParse(schema, { ...base, price: 100, priceMax: 120 }).success).toBe(true);
		}
	});

	it('rejects non-positive, fractional, and non-numeric wire quantities', () => {
		for (const quantity of [0, -1, 1.5, 'two']) {
			expect(v.safeParse(GiftDraftInputSchema, { name: 'Kniha', quantity }).success).toBe(
				false,
			);
		}
	});
});
