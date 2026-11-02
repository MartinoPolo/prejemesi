import { describe, expect, it } from 'vitest';
import type { WishlistBackgroundPhotoLayer } from '$lib/theme/wishlist_background_library.js';
import {
	backgroundPhotoLayerForMode,
	customBackgroundPhoto,
	libraryBackgroundPhoto,
} from './wishlist_background_photo.js';

const LIGHT_LAYER: WishlistBackgroundPhotoLayer = { shownIn: 'light', src: 'light.webp' };
const DARK_LAYER: WishlistBackgroundPhotoLayer = { shownIn: 'dark', src: 'dark.webp' };
const ONLY_LAYER: WishlistBackgroundPhotoLayer = { shownIn: null, src: 'only.webp' };

describe('background photo dark-mode dim', () => {
	it('dims a custom photo in dark mode', () => {
		expect(customBackgroundPhoto(ONLY_LAYER).dimsInDarkMode).toBe(true);
	});

	it('never dims a library image, which has its own dark file', () => {
		expect(libraryBackgroundPhoto([LIGHT_LAYER, DARK_LAYER]).dimsInDarkMode).toBe(false);
	});
});

describe('backgroundPhotoLayerForMode', () => {
	it.each(['light', 'dark'] as const)('picks the %s file of a library image', (mode) => {
		const photo = libraryBackgroundPhoto([LIGHT_LAYER, DARK_LAYER]);

		expect(backgroundPhotoLayerForMode(photo, mode).shownIn).toBe(mode);
	});

	it.each(['light', 'dark'] as const)('shows a custom photo in %s mode', (mode) => {
		expect(backgroundPhotoLayerForMode(customBackgroundPhoto(ONLY_LAYER), mode)).toBe(
			ONLY_LAYER,
		);
	});
});
