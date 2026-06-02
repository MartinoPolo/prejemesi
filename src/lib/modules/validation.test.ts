import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import { CreateWishlistInputSchema, WISHLIST_THEMES } from './wishlists/types.js';
import { CreateGiftInputSchema, GIFT_CURRENCY_VALUES } from './gifts/types.js';
import { ReserveGiftInputSchema } from './reservations/types.js';

function parseSuccess(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	input: unknown,
) {
	return v.safeParse(schema, input);
}

describe('CreateWishlistInputSchema', () => {
	it('accepts valid input with title only', () => {
		const result = parseSuccess(CreateWishlistInputSchema, { title: 'My Wishlist' });
		expect(result.success).toBe(true);
	});

	it('accepts valid input with all fields', () => {
		const result = parseSuccess(CreateWishlistInputSchema, {
			title: 'Birthday List',
			eventDate: new Date('2026-12-01'),
			theme: 'birthday',
		});
		expect(result.success).toBe(true);
	});

	it('accepts null eventDate and undefined theme', () => {
		const result = parseSuccess(CreateWishlistInputSchema, {
			title: 'Neutral List',
			eventDate: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty title', () => {
		const result = parseSuccess(CreateWishlistInputSchema, { title: '' });
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects whitespace-only title (trimmed to empty)', () => {
		const result = parseSuccess(CreateWishlistInputSchema, { title: '   ' });
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects invalid theme value', () => {
		const result = parseSuccess(CreateWishlistInputSchema, {
			title: 'My List',
			theme: 'neon',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts all valid theme values', () => {
		for (const theme of WISHLIST_THEMES) {
			const result = parseSuccess(CreateWishlistInputSchema, {
				title: 'Themed List',
				theme,
			});
			expect(result.success, `theme "${theme}" should be valid`).toBe(true);
		}
	});
});

describe('CreateGiftInputSchema', () => {
	it('accepts valid input with required fields only', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
		});
		expect(result.success).toBe(true);
	});

	it('rejects empty gift name', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: '',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects whitespace-only gift name (trimmed to empty)', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: '   ',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects invalid URL format', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			url: 'not-a-url',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts valid URL', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			url: 'https://example.com/product',
		});
		expect(result.success).toBe(true);
	});

	it('accepts null URL', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			url: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects negative price', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			price: -1,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts zero price', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			price: 0,
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity of 0', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 0,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects non-integer quantity (e.g., 1.5)', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 1.5,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts quantity of 1', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			quantity: 1,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid currency', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			currency: 'GBP',
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts all valid currencies (CZK, EUR, USD)', () => {
		for (const currency of GIFT_CURRENCY_VALUES) {
			const result = parseSuccess(CreateGiftInputSchema, {
				wishlistId: 'wl-1',
				name: 'Nice Book',
				currency,
			});
			expect(result.success, `currency "${currency}" should be valid`).toBe(true);
		}
	});

	it('accepts null currency', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			currency: null,
		});
		expect(result.success).toBe(true);
	});
});

describe('ReserveGiftInputSchema', () => {
	it('accepts valid reservation', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 2,
		});
		expect(result.success).toBe(true);
	});

	it('rejects quantity of 0', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 0,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects negative quantity', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: -3,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('rejects non-integer quantity', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 2.7,
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts quantity of 1', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 1,
		});
		expect(result.success).toBe(true);
	});

	it('accepts optional anonymous fields', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 1,
			anonymousName: 'Jane',
			anonymousEmail: 'jane@example.com',
		});
		expect(result.success).toBe(true);
	});

	it('accepts reservation without anonymous fields', () => {
		const result = parseSuccess(ReserveGiftInputSchema, {
			giftId: 'gift-1',
			quantity: 3,
		});
		expect(result.success).toBe(true);
	});
});
