import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BACKGROUND_VARIANTS, THEME_PROMPTS } from '../../../scripts/theme_background_prompts.mjs';
import { WISHLIST_THEME_IDS } from './wishlist_themes.js';

// The shipped manifest is empty until the offline generator fills it.
vi.mock('./wishlist_background_library.json', () => ({
	default: [
		{ id: 'toys-illustrated', themeId: 'toys', variant: 'illustrated', widths: [1280, 2560] },
		{
			id: 'christmas-illustrated',
			themeId: 'christmas',
			variant: 'illustrated',
			widths: [1280],
		},
		{
			id: 'christmas-photo',
			themeId: 'christmas',
			variant: 'photo',
			widths: [640, 1280, 2560],
		},
	],
}));

const {
	findWishlistLibraryImage,
	WISHLIST_LIBRARY_IMAGE_VARIANTS,
	isWishlistLibraryImageId,
	wishlistLibraryImageSource,
	wishlistLibraryImageThumbnailUrl,
	wishlistLibraryImagesForTheme,
} = await import('./wishlist_background_library.js');

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

	it('serves static WebP files with the smallest width as thumbnail and every width as srcset', () => {
		const image = findWishlistLibraryImage('christmas-photo');
		expect(image).not.toBeNull();
		if (image === null) {
			return;
		}
		expect(wishlistLibraryImageThumbnailUrl(image)).toMatch(
			/\/wishlist-backgrounds\/christmas-photo-640\.webp$/,
		);
		const source = wishlistLibraryImageSource(image);
		expect(source.src).toMatch(/\/wishlist-backgrounds\/christmas-photo-2560\.webp$/);
		expect(source.srcset.split(', ')).toEqual([
			expect.stringMatching(/christmas-photo-640\.webp 640w$/),
			expect.stringMatching(/christmas-photo-1280\.webp 1280w$/),
			expect.stringMatching(/christmas-photo-2560\.webp 2560w$/),
		]);
	});

	it('rejects a manifest entry for an unknown theme when the module loads', async () => {
		vi.resetModules();
		vi.doMock('./wishlist_background_library.json', () => ({
			default: [
				{ id: 'halloween-photo', themeId: 'halloween', variant: 'photo', widths: [1280] },
			],
		}));
		try {
			await expect(import('./wishlist_background_library.js')).rejects.toThrow(/"halloween"/);
		} finally {
			vi.doUnmock('./wishlist_background_library.json');
			vi.resetModules();
		}
	});
});

describe('wishlist background generator prompts', () => {
	it('cover every wishlist theme in registry order', () => {
		expect(Object.keys(THEME_PROMPTS)).toEqual([...WISHLIST_THEME_IDS]);
	});

	it('generate exactly the library variants', () => {
		expect(BACKGROUND_VARIANTS).toEqual([...WISHLIST_LIBRARY_IMAGE_VARIANTS]);
	});
});

describe('shipped wishlist background manifest', () => {
	const manifestEntries: { id: string; widths: number[] }[] = JSON.parse(
		readFileSync(new URL('./wishlist_background_library.json', import.meta.url), 'utf8'),
	);

	it('has a static WebP file for every listed width', () => {
		const missingFiles = manifestEntries
			.flatMap(({ id, widths }) => widths.map((width) => `${id}-${String(width)}.webp`))
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
});
