import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { DEFAULT_DRAFT_PRIORITY, GiftDraftInputSchema } from './types.js';

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

	it('rejects non-positive, fractional, and non-numeric wire quantities', () => {
		for (const quantity of [0, -1, 1.5, 'two']) {
			expect(v.safeParse(GiftDraftInputSchema, { name: 'Kniha', quantity }).success).toBe(
				false,
			);
		}
	});
});
