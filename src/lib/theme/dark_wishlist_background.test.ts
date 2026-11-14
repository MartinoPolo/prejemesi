import { describe, expect, it } from 'vitest';
import {
	DARK_WISHLIST_BACKGROUNDS,
	DEFAULT_DARK_WISHLIST_BACKGROUND,
	isDarkWishlistBackground,
} from './dark_wishlist_background.js';

describe('viewer dark wishlist background domain', () => {
	it('accepts exactly wishlist, app, and tint with app as the default', () => {
		expect(DARK_WISHLIST_BACKGROUNDS).toEqual(['wishlist', 'app', 'tint']);
		expect(DEFAULT_DARK_WISHLIST_BACKGROUND).toBe('app');
		expect(DARK_WISHLIST_BACKGROUNDS.every(isDarkWishlistBackground)).toBe(true);
		expect(['', 'palette', 'App', null, 1].some(isDarkWishlistBackground)).toBe(false);
	});
});
