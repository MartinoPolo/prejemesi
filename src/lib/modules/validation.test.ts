import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	CreateWishlistInputSchema,
	UpdateWishlistInputSchema,
	WISHLIST_THEMES,
	RECIPIENT_NAME_MAX_LENGTH,
} from './wishlists/types.js';
import {
	CreateGiftInputSchema,
	UpdateGiftInputSchema,
	GIFT_CURRENCY_VALUES,
} from './gifts/types.js';
import { ReserveGiftInputSchema } from './reservations/types.js';
import {
	ImageMetadataSchema,
	WishlistImageSlotsSchema,
	IMAGE_FIT_MODE_VALUES,
} from './images/types.js';
import { UpdateAppBackgroundThemeInputSchema } from './settings/types.js';
import { BACKGROUND_THEMES } from '$lib/components/base/theme/types.js';

function parseSuccess(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	input: unknown,
) {
	return v.safeParse(schema, input);
}

describe('CreateWishlistInputSchema', () => {
	// The schema is a valibot variant on `recipientKind` (issue #99):
	//   - `self`  : creator is the linked recipient (the old for-me flow).
	//   - `other` : a free-text recipient; creator becomes the first správce.

	describe('recipientKind: self (for-me creation)', () => {
		it('accepts valid input with title only', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My Wishlist',
			});
			expect(result.success).toBe(true);
		});

		it('accepts valid input with all fields', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'Birthday List',
				eventDate: new Date('2026-12-01'),
				theme: 'birthday',
			});
			expect(result.success).toBe(true);
		});

		it('accepts null eventDate and undefined theme', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'Neutral List',
				eventDate: null,
			});
			expect(result.success).toBe(true);
		});

		it('rejects empty title', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: '',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects whitespace-only title (trimmed to empty)', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: '   ',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects invalid theme value', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My List',
				theme: 'neon',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('accepts all valid theme values', () => {
			for (const theme of WISHLIST_THEMES) {
				const result = parseSuccess(CreateWishlistInputSchema, {
					recipientKind: 'self',
					title: 'Themed List',
					theme,
				});
				expect(result.success, `theme "${theme}" should be valid`).toBe(true);
			}
		});

		it('rejects a self list carrying a recipientName it should not have', () => {
			// The `self` variant object has no recipientName field; valibot drops the
			// unknown key, so the parse still succeeds on the rest of a valid input.
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'self',
				title: 'My List',
				recipientName: 'Rosie',
			});
			expect(result.success).toBe(true);
		});
	});

	describe('recipientKind: other (for-someone creation)', () => {
		it('accepts valid input with a recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
		});

		it('accepts all fields including a recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: 'Rosie Birthday',
				eventDate: new Date('2026-12-01'),
				theme: 'birthday',
			});
			expect(result.success).toBe(true);
		});

		it('trims surrounding whitespace on the recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '  Rosie  ',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.output).toMatchObject({ recipientName: 'Rosie' });
			}
		});

		it('rejects a missing recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects an empty recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects a whitespace-only recipient name (trimmed to empty)', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: '   ',
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it(`accepts a recipient name at the ${RECIPIENT_NAME_MAX_LENGTH}-char maximum`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'a'.repeat(RECIPIENT_NAME_MAX_LENGTH),
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(true);
		});

		it(`rejects a recipient name over ${RECIPIENT_NAME_MAX_LENGTH} chars`, () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'a'.repeat(RECIPIENT_NAME_MAX_LENGTH + 1),
				title: 'Rosie Birthday',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects an empty title even with a valid recipient name', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'other',
				recipientName: 'Rosie',
				title: '',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});
	});

	describe('recipientKind discriminator', () => {
		it('rejects an unknown recipientKind', () => {
			const result = parseSuccess(CreateWishlistInputSchema, {
				recipientKind: 'group',
				title: 'My List',
			});
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});

		it('rejects a missing recipientKind', () => {
			const result = parseSuccess(CreateWishlistInputSchema, { title: 'My List' });
			expect(result.success).toBe(false);
			expect(result.issues).toBeDefined();
		});
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

	it('rejects a link with an invalid URL format', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: [{ url: 'not-a-url' }],
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
	});

	it('accepts links with valid URLs and optional labels', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: [
				{ url: 'https://example.com/product' },
				{ url: 'https://other.example.com/product', label: 'Alternative' },
			],
		});
		expect(result.success).toBe(true);
	});

	it('accepts null links', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects more than 10 links', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Nice Book',
			links: Array.from({ length: 11 }, (_, i) => ({ url: `https://example.com/${i}` })),
		});
		expect(result.success).toBe(false);
		expect(result.issues).toBeDefined();
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

describe('ImageMetadataSchema', () => {
	it('accepts metadata with only the required fit mode', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'auto' });
		expect(result.success).toBe(true);
	});

	it('accepts every valid fit mode', () => {
		for (const fitMode of IMAGE_FIT_MODE_VALUES) {
			const result = parseSuccess(ImageMetadataSchema, { fitMode });
			expect(result.success, `fitMode "${fitMode}" should be valid`).toBe(true);
		}
	});

	it('rejects an unknown fit mode', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'stretch' });
		expect(result.success).toBe(false);
	});

	it('accepts a fully specified metadata object', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			cropRect: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 },
			focal: { x: 50, y: 40 },
			zoom: 2,
			bgColor: '#ffffff',
		});
		expect(result.success).toBe(true);
	});

	it('accepts null cropRect and null bgColor', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'auto',
			cropRect: null,
			bgColor: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects a crop rectangle outside the normalized 0..1 range', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			cropRect: { x: 0, y: 0, w: 1.5, h: 1 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects a focal point outside the 0..100 percent range', () => {
		const result = parseSuccess(ImageMetadataSchema, {
			fitMode: 'cover-crop',
			focal: { x: 120, y: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects a zoom factor below the minimum', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'cover-crop', zoom: 0.5 });
		expect(result.success).toBe(false);
	});

	it('rejects a zoom factor above the maximum', () => {
		const result = parseSuccess(ImageMetadataSchema, { fitMode: 'cover-crop', zoom: 4 });
		expect(result.success).toBe(false);
	});
});

describe('WishlistImageSlotsSchema', () => {
	it('accepts an empty slots object', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {});
		expect(result.success).toBe(true);
	});

	it('accepts per-slot metadata for all four slots', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {
			card: { fitMode: 'cover-crop', focal: { x: 50, y: 40 } },
			thumbnail: { fitMode: 'cover-crop' },
			banner: { fitMode: 'contain-padded', cropRect: { x: 0, y: 0.1, w: 1, h: 0.5 } },
			social: { fitMode: 'auto', bgColor: '#0b3d2e' },
		});
		expect(result.success).toBe(true);
	});

	it('rejects a slot carrying invalid metadata', () => {
		const result = parseSuccess(WishlistImageSlotsSchema, {
			card: { fitMode: 'bogus' },
		});
		expect(result.success).toBe(false);
	});
});

describe('CreateGiftInputSchema – image metadata', () => {
	it('accepts a gift with valid image metadata', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageKey: 'gifts/camera.jpg',
			imageMeta: { fitMode: 'cover-crop', focal: { x: 60, y: 40 }, zoom: 1.5 },
		});
		expect(result.success).toBe(true);
	});

	it('accepts null image metadata', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageMeta: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid image metadata on a gift', () => {
		const result = parseSuccess(CreateGiftInputSchema, {
			wishlistId: 'wl-1',
			name: 'Camera',
			imageMeta: { fitMode: 'auto', zoom: 99 },
		});
		expect(result.success).toBe(false);
	});
});

describe('UpdateGiftInputSchema – image metadata', () => {
	it('accepts updating only image metadata', () => {
		const result = parseSuccess(UpdateGiftInputSchema, {
			id: 'gift-1',
			imageMeta: { fitMode: 'contain-padded' },
		});
		expect(result.success).toBe(true);
	});
});

describe('UpdateWishlistInputSchema – image assignment', () => {
	it('accepts a single image key plus per-slot metadata', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageKey: 'wishlists/hero.jpg',
			imageSlots: {
				card: { fitMode: 'cover-crop' },
				banner: { fitMode: 'cover-crop', cropRect: { x: 0, y: 0, w: 1, h: 0.5 } },
			},
		});
		expect(result.success).toBe(true);
	});

	it('accepts clearing the image (null key and null slots)', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageKey: null,
			imageSlots: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects invalid per-slot metadata', () => {
		const result = parseSuccess(UpdateWishlistInputSchema, {
			id: 'wl-1',
			imageSlots: { thumbnail: { fitMode: 'auto', focal: { x: -1, y: 0 } } },
		});
		expect(result.success).toBe(false);
	});

	it('no longer accepts the removed banner/thumbnail keys as the source of truth', () => {
		// The obsolete fields are simply ignored (valibot objects drop unknown keys);
		// the schema must still validate without them present.
		const result = parseSuccess(UpdateWishlistInputSchema, { id: 'wl-1' });
		expect(result.success).toBe(true);
	});
});

describe('UpdateAppBackgroundThemeInputSchema', () => {
	it('accepts every supported background theme', () => {
		for (const theme of BACKGROUND_THEMES) {
			const result = parseSuccess(UpdateAppBackgroundThemeInputSchema, {
				appBackgroundTheme: theme,
			});
			expect(result.success, `theme "${theme}" should be valid`).toBe(true);
		}
	});

	it('rejects an unsupported background theme', () => {
		const result = parseSuccess(UpdateAppBackgroundThemeInputSchema, {
			appBackgroundTheme: 'midnight',
		});
		expect(result.success).toBe(false);
	});

	it('rejects a missing background theme', () => {
		const result = parseSuccess(UpdateAppBackgroundThemeInputSchema, {});
		expect(result.success).toBe(false);
	});
});
