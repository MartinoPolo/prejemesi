import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_WISHLIST_BACKGROUND } from '$lib/theme/wishlist_themes.js';
import {
	WishlistAppearanceInputSchema,
	sanitizeWishlistAppearance,
	wishlistBackgroundImageKey,
} from './wishlist_appearance.js';

// The shipped library is empty until images are generated.
vi.mock('$lib/theme/wishlist_background_library.json', () => ({
	default: [{ id: 'gamer-photo', themeId: 'gamer', variant: 'photo', widths: [1280, 2560] }],
}));

const validAppearance = {
	themeId: 'gamer',
	styleTokens: { corners: 'sharp' },
	background: DEFAULT_WISHLIST_BACKGROUND,
};

describe('WishlistAppearanceInputSchema', () => {
	it('accepts a registry theme, partial token overrides and a complete background', () => {
		expect(v.safeParse(WishlistAppearanceInputSchema, validAppearance).success).toBe(true);
	});

	it('accepts a library background naming an image from the library', () => {
		const libraryBackground = {
			...DEFAULT_WISHLIST_BACKGROUND,
			mode: 'library',
			libraryImageId: 'gamer-photo',
		};
		const parsed = v.safeParse(WishlistAppearanceInputSchema, {
			...validAppearance,
			background: libraryBackground,
		});
		expect(parsed.success).toBe(true);
		expect(parsed.output).toMatchObject({ background: libraryBackground });
	});

	it('accepts clearing every appearance field', () => {
		const cleared = { themeId: null, styleTokens: null, background: null };
		expect(v.safeParse(WishlistAppearanceInputSchema, cleared).success).toBe(true);
	});

	it('accepts a background without an image key, which keeps the stored upload', () => {
		const { mode, focal, placement, dim, motion } = DEFAULT_WISHLIST_BACKGROUND;
		const backgroundWithoutImageKey = { mode, focal, placement, dim, motion };
		const parsed = v.safeParse(WishlistAppearanceInputSchema, {
			...validAppearance,
			background: backgroundWithoutImageKey,
		});
		expect(parsed.success).toBe(true);
		expect(parsed.output).toMatchObject({ background: backgroundWithoutImageKey });
		expect(parsed.output).not.toHaveProperty('background.imageKey');
	});

	it.each([
		['an unknown theme', { ...validAppearance, themeId: 'halloween' }],
		['an unknown token key', { ...validAppearance, styleTokens: { glow: 'neon' } }],
		['an unknown token value', { ...validAppearance, styleTokens: { corners: 'wavy' } }],
		[
			'a dim above the maximum',
			{ ...validAppearance, background: { ...DEFAULT_WISHLIST_BACKGROUND, dim: 61 } },
		],
		[
			'a fractional dim',
			{ ...validAppearance, background: { ...DEFAULT_WISHLIST_BACKGROUND, dim: 10.5 } },
		],
		[
			'a negative dim',
			{ ...validAppearance, background: { ...DEFAULT_WISHLIST_BACKGROUND, dim: -1 } },
		],
		[
			'a focal point outside 0–100',
			{
				...validAppearance,
				background: { ...DEFAULT_WISHLIST_BACKGROUND, focal: { x: 101, y: 50 } },
			},
		],
		[
			'an unknown background mode',
			{ ...validAppearance, background: { ...DEFAULT_WISHLIST_BACKGROUND, mode: 'video' } },
		],
		['an incomplete background', { ...validAppearance, background: { mode: 'none' } }],
		[
			'a library image id that is not in the library',
			{
				...validAppearance,
				background: {
					...DEFAULT_WISHLIST_BACKGROUND,
					mode: 'library',
					libraryImageId: 'gamer-retired',
				},
			},
		],
	])('rejects %s', (_label, appearance) => {
		expect(v.safeParse(WishlistAppearanceInputSchema, appearance).success).toBe(false);
	});
});

describe('sanitizeWishlistAppearance', () => {
	it('keeps valid stored appearance as stored', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: 'minimal',
				styleTokens: { corners: 'round' },
				background: { mode: 'none', dim: 30 },
			}),
		).toEqual({
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: { mode: 'none', dim: 30 },
		});
	});

	it('reads an unknown theme id as no theme', () => {
		expect(
			sanitizeWishlistAppearance({ themeId: 'retired', styleTokens: null, background: null })
				.themeId,
		).toBeNull();
	});

	it('drops unknown token keys and values and keeps the valid ones', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: null,
				styleTokens: { corners: 'wavy', border: 'fine', glow: 'neon' },
				background: null,
			}).styleTokens,
		).toEqual({ border: 'fine' });
	});

	it('reads overrides with nothing valid left, or malformed JSON, as null', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: null,
				styleTokens: { corners: 'wavy' },
				background: ['not', 'an', 'object'],
			}),
		).toEqual({ themeId: null, styleTokens: null, background: null });
	});

	it('drops out-of-range background fields', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: null,
				styleTokens: null,
				background: { mode: 'custom', dim: 99, focal: { x: -5, y: 50 }, motion: 'off' },
			}).background,
		).toEqual({ mode: 'custom', motion: 'off' });
	});

	it('keeps a stored library image that is still in the library', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: 'gamer',
				styleTokens: null,
				background: { mode: 'library', libraryImageId: 'gamer-photo' },
			}).background,
		).toEqual({ mode: 'library', libraryImageId: 'gamer-photo' });
	});

	it.each([
		[
			'a library image id that left the library',
			{ mode: 'library', libraryImageId: 'gamer-retired', dim: 30 },
			{ dim: 30 },
		],
		['no library image id', { mode: 'library', dim: 30 }, { dim: 30 }],
		[
			'a null library image id',
			{ mode: 'library', libraryImageId: null, dim: 30 },
			{ libraryImageId: null, dim: 30 },
		],
	])('drops library mode with %s so the default mode applies', (_label, stored, expected) => {
		expect(
			sanitizeWishlistAppearance({ themeId: 'gamer', styleTokens: null, background: stored })
				.background,
		).toEqual(expected);
	});

	it('reads a library mode without an image and no other field as no background', () => {
		expect(
			sanitizeWishlistAppearance({
				themeId: 'gamer',
				styleTokens: null,
				background: { mode: 'library', libraryImageId: 'gamer-retired' },
			}).background,
		).toBeNull();
	});
});

describe('wishlistBackgroundImageKey', () => {
	it('returns the stored custom upload key, also while another mode is selected', () => {
		expect(
			wishlistBackgroundImageKey({ mode: 'theme', imageKey: 'wishlists/backgrounds/a.webp' }),
		).toBe('wishlists/backgrounds/a.webp');
	});

	it('returns null without a stored background', () => {
		expect(wishlistBackgroundImageKey(null)).toBeNull();
	});
});
