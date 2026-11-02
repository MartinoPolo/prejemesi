import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
	BACKGROUND_MODES,
	BACKGROUND_VARIANTS,
	THEME_PROMPTS,
	backgroundCounterpartPrompt,
	backgroundPrompt,
} from '../../../scripts/theme_background_prompts.mjs';
import type { WishlistLibraryImageMode } from './wishlist_background_library.js';
import { WISHLIST_THEME_IDS } from './wishlist_themes.js';

// A small fixture library; every image has a light and a dark file.
vi.mock('./wishlist_background_library.json', () => ({
	default: [
		{
			id: 'toys-illustrated',
			themeId: 'toys',
			variant: 'illustrated',
			widthsByMode: { light: [1280, 2560], dark: [1280, 2560] },
		},
		{
			id: 'christmas-illustrated',
			themeId: 'christmas',
			variant: 'illustrated',
			widthsByMode: { light: [1280], dark: [1280] },
		},
		{
			id: 'christmas-photo',
			themeId: 'christmas',
			variant: 'photo',
			widthsByMode: { light: [640, 1280, 2560], dark: [640, 1280, 2560] },
		},
	],
}));

const {
	findWishlistLibraryImage,
	WISHLIST_LIBRARY_IMAGE_MODES,
	WISHLIST_LIBRARY_IMAGE_VARIANTS,
	isWishlistLibraryImageId,
	wishlistLibraryImageLayers,
	wishlistLibraryImageThumbnailLayers,
	wishlistLibraryImagesForTheme,
} = await import('./wishlist_background_library.js');

function libraryImage(id: string) {
	const image = findWishlistLibraryImage(id);
	if (image === null) {
		throw new Error(`Fixture image ${id} is missing.`);
	}
	return image;
}

describe('wishlist background library', () => {
	it('recognizes only ids listed in the manifest', () => {
		expect(isWishlistLibraryImageId('christmas-photo')).toBe(true);
		expect(isWishlistLibraryImageId('christmas-retired')).toBe(false);
		expect(isWishlistLibraryImageId(null)).toBe(false);
		expect(isWishlistLibraryImageId(42)).toBe(false);
	});

	it('finds an image by id and returns null for an unknown or missing id', () => {
		expect(findWishlistLibraryImage('toys-illustrated')).toMatchObject({
			themeId: 'toys',
			variant: 'illustrated',
		});
		expect(findWishlistLibraryImage('gone')).toBeNull();
		expect(findWishlistLibraryImage(null)).toBeNull();
	});

	it('lists the current theme images first, then the rest in theme order', () => {
		expect(wishlistLibraryImagesForTheme('christmas').map((image) => image.id)).toEqual([
			'christmas-illustrated',
			'christmas-photo',
			'toys-illustrated',
		]);
		expect(wishlistLibraryImagesForTheme(null).map((image) => image.id)).toEqual([
			'toys-illustrated',
			'christmas-illustrated',
			'christmas-photo',
		]);
	});

	it('serves each mode of a pair from its own files, every width as srcset', () => {
		const layers = wishlistLibraryImageLayers(libraryImage('toys-illustrated'));

		expect(layers).toEqual([
			{
				shownIn: 'light',
				src: expect.stringMatching(
					/\/wishlist-backgrounds\/toys-illustrated-light-2560\.webp$/,
				),
				srcset: expect.stringMatching(
					/toys-illustrated-light-1280\.webp 1280w, .*toys-illustrated-light-2560\.webp 2560w$/,
				),
			},
			{
				shownIn: 'dark',
				src: expect.stringMatching(
					/\/wishlist-backgrounds\/toys-illustrated-dark-2560\.webp$/,
				),
				srcset: expect.stringMatching(
					/toys-illustrated-dark-1280\.webp 1280w, .*toys-illustrated-dark-2560\.webp 2560w$/,
				),
			},
		]);
	});

	it('previews each mode of a pair with its smallest file', () => {
		expect(wishlistLibraryImageThumbnailLayers(libraryImage('toys-illustrated'))).toEqual([
			{
				shownIn: 'light',
				src: expect.stringMatching(/toys-illustrated-light-1280\.webp$/),
			},
			{
				shownIn: 'dark',
				src: expect.stringMatching(/toys-illustrated-dark-1280\.webp$/),
			},
		]);
	});

	it.each([
		{
			problem: 'an unknown theme',
			entry: {
				id: 'halloween-photo',
				themeId: 'halloween',
				variant: 'photo',
				widthsByMode: { light: [1280], dark: [1280] },
			},
			message: /"halloween"/,
		},
		{
			problem: 'no dark file',
			entry: {
				id: 'toys-photo',
				themeId: 'toys',
				variant: 'photo',
				widthsByMode: { light: [1280] },
			},
			message: /"dark"/,
		},
	])(
		'rejects a manifest entry with $problem when the module loads',
		async ({ entry, message }) => {
			vi.resetModules();
			vi.doMock('./wishlist_background_library.json', () => ({ default: [entry] }));
			try {
				await expect(import('./wishlist_background_library.js')).rejects.toThrow(message);
			} finally {
				vi.doUnmock('./wishlist_background_library.json');
				vi.resetModules();
			}
		},
	);
});

describe('wishlist background generator prompts', () => {
	it('cover every wishlist theme in registry order', () => {
		expect(Object.keys(THEME_PROMPTS)).toEqual([...WISHLIST_THEME_IDS]);
	});

	it('generate exactly the library variants and modes', () => {
		expect(BACKGROUND_VARIANTS).toEqual([...WISHLIST_LIBRARY_IMAGE_VARIANTS]);
		expect(BACKGROUND_MODES).toEqual([...WISHLIST_LIBRARY_IMAGE_MODES]);
	});

	it('describe each mode with its own palette, so a pair differs in ground and light', () => {
		for (const themeId of WISHLIST_THEME_IDS) {
			const lightPrompt = backgroundPrompt(themeId, 'photo', 'light');
			const darkPrompt = backgroundPrompt(themeId, 'photo', 'dark');
			expect(lightPrompt).toContain(THEME_PROMPTS[themeId].palette.light);
			expect(darkPrompt).toContain(THEME_PROMPTS[themeId].palette.dark);
			expect(lightPrompt).not.toEqual(darkPrompt);
		}
	});

	it('edit the other mode into its counterpart while keeping the composition', () => {
		const prompt = backgroundCounterpartPrompt('christmas', 'illustrated', 'light');

		expect(prompt).toMatch(/^Edit the attached dark .* into its light version\./);
		expect(prompt).toContain('Keep the exact composition');
		expect(prompt).toContain(THEME_PROMPTS.christmas.palette.light);
	});
});

describe('shipped wishlist background manifest', () => {
	const manifestEntries: {
		id: string;
		widthsByMode: Partial<Record<WishlistLibraryImageMode, number[]>>;
	}[] = JSON.parse(
		readFileSync(new URL('./wishlist_background_library.json', import.meta.url), 'utf8'),
	);

	it('has a static WebP file for every listed mode and width', () => {
		const missingFiles = manifestEntries
			.flatMap(({ id, widthsByMode }) =>
				Object.entries(widthsByMode).flatMap(([mode, widths]) =>
					widths.map((width) => `${id}-${mode}-${String(width)}.webp`),
				),
			)
			.filter(
				(fileName) =>
					!existsSync(
						new URL(
							`../../../static/wishlist-backgrounds/${fileName}`,
							import.meta.url,
						),
					),
			);
		expect(missingFiles).toEqual([]);
	});

	it('lists a light and a dark file for every image', () => {
		expect(
			manifestEntries
				.filter(({ widthsByMode }) =>
					WISHLIST_LIBRARY_IMAGE_MODES.some(
						(mode) => (widthsByMode[mode]?.length ?? 0) === 0,
					),
				)
				.map(({ id }) => id),
		).toEqual([]);
	});

	it('keeps an entry for every theme and variant, so stored selections stay valid', () => {
		expect(manifestEntries.map(({ id }) => id)).toEqual(
			WISHLIST_THEME_IDS.flatMap((themeId) =>
				WISHLIST_LIBRARY_IMAGE_VARIANTS.map((variant) => `${themeId}-${variant}`),
			),
		);
	});
});
