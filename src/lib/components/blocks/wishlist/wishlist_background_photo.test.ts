import { describe, expect, it } from 'vitest';
import type {
	WishlistBackgroundPhotoLayer,
	WishlistLibraryImage,
} from '$lib/theme/wishlist_background_library.js';
import {
	backgroundPhotoLayerForMode,
	customBackgroundPhoto,
	libraryBackgroundPhoto,
} from './wishlist_background_photo.js';

function libraryImage(widthsByMode: WishlistLibraryImage['widthsByMode']): WishlistLibraryImage {
	return { id: 'space-photo', themeId: 'space', variant: 'photo', widthsByMode };
}

const LIGHT_LAYER: WishlistBackgroundPhotoLayer = { shownIn: 'light', src: 'light.webp' };
const DARK_LAYER: WishlistBackgroundPhotoLayer = { shownIn: 'dark', src: 'dark.webp' };
const ONLY_LAYER: WishlistBackgroundPhotoLayer = { shownIn: null, src: 'only.webp' };

describe('background photo dark-mode dim', () => {
	it('dims a custom photo in dark mode', () => {
		expect(customBackgroundPhoto(ONLY_LAYER).dimsInDarkMode).toBe(true);
	});

	it('dims a light-only library image in dark mode', () => {
		const photo = libraryBackgroundPhoto(libraryImage({ light: [1280] }), [ONLY_LAYER]);

		expect(photo.dimsInDarkMode).toBe(true);
	});

	it.each([
		['a light and dark pair', { light: [1280], dark: [1280] }],
		['a dark-only image', { dark: [1280] }],
	])('never dims %s', (_name, widthsByMode) => {
		const photo = libraryBackgroundPhoto(libraryImage(widthsByMode), [ONLY_LAYER]);

		expect(photo.dimsInDarkMode).toBe(false);
	});
});

describe('backgroundPhotoLayerForMode', () => {
	it.each(['light', 'dark'] as const)('picks the %s file of a pair', (mode) => {
		const photo = libraryBackgroundPhoto(libraryImage({ light: [1280], dark: [1280] }), [
			LIGHT_LAYER,
			DARK_LAYER,
		]);

		expect(backgroundPhotoLayerForMode(photo, mode).shownIn).toBe(mode);
	});

	it.each(['light', 'dark'] as const)('shows a lone file in %s mode', (mode) => {
		expect(backgroundPhotoLayerForMode(customBackgroundPhoto(ONLY_LAYER), mode)).toBe(
			ONLY_LAYER,
		);
	});
});
