import { describe, expect, it } from 'vitest';
import { imagePublicUrl } from '$lib/modules/images/public_url.js';
import { DEFAULT_WISHLIST_BACKGROUND } from '$lib/theme/wishlist_themes.js';
import {
	resolveWishlistThemeScope,
	wishlistThemeScopeAttributes,
	type WishlistAppearancePreview,
} from './wishlist_theme_scope.js';

function scopeAttributes(appearance: WishlistAppearancePreview) {
	return wishlistThemeScopeAttributes(resolveWishlistThemeScope(appearance));
}

describe('wishlist theme scope', () => {
	it('keeps an unthemed wishlist on the default look without a backdrop', () => {
		expect(scopeAttributes({ themeId: null, styleTokens: null, background: null })).toEqual({
			'data-wishlist-theme': undefined,
			'data-wishlist-background': 'none',
			'data-wishlist-backdrop': undefined,
			'data-wishlist-dark-backdrop': undefined,
			'data-wishlist-placement': undefined,
			'data-corners': 'round',
			'data-border': 'bold',
			'data-mat': 'dotted',
			'data-heading': 'playful',
		});
	});

	it('paints the theme backdrop with the theme style, letting saved tokens win', () => {
		expect(
			scopeAttributes({
				themeId: 'gamer',
				styleTokens: { heading: 'hand' },
				background: null,
			}),
		).toMatchObject({
			'data-wishlist-theme': 'gamer',
			'data-wishlist-background': 'theme',
			'data-wishlist-backdrop': '',
			'data-wishlist-dark-backdrop': '',
			'data-corners': 'soft',
			'data-mat': 'black',
			'data-heading': 'hand',
		});
	});

	it('marks only dark-native themes as dark backdrops', () => {
		expect(
			scopeAttributes({ themeId: 'toys', styleTokens: null, background: null })[
				'data-wishlist-dark-backdrop'
			],
		).toBeUndefined();
	});

	it('drops the theme backdrop for mode none but keeps the theme for placeholders and tokens', () => {
		const scope = resolveWishlistThemeScope({
			themeId: 'minimal',
			styleTokens: null,
			background: { mode: 'none' },
		});
		expect(scope.placeholderThemeId).toBe('minimal');
		expect(wishlistThemeScopeAttributes(scope)).toMatchObject({
			'data-wishlist-theme': undefined,
			'data-wishlist-background': 'none',
			'data-wishlist-backdrop': undefined,
			'data-corners': 'sharp',
			'data-border': 'fine',
			'data-heading': 'plain',
		});
	});

	it('renders nothing for a custom background that has no image yet', () => {
		const scope = resolveWishlistThemeScope({
			themeId: null,
			styleTokens: null,
			background: { mode: 'custom' },
		});
		expect(scope.backgroundMode).toBe('none');
		expect(scope.customImageUrl).toBeNull();
		expect(scope.darkBackdrop).toBe(false);
	});

	it('renders a stored custom photo as a dark backdrop with its placement', () => {
		const scope = resolveWishlistThemeScope({
			themeId: 'toys',
			styleTokens: null,
			background: {
				...DEFAULT_WISHLIST_BACKGROUND,
				mode: 'custom',
				imageKey: 'bg/photo.webp',
			},
		});
		expect(scope.customImageUrl).toBe(imagePublicUrl('bg/photo.webp'));
		expect(wishlistThemeScopeAttributes(scope)).toMatchObject({
			'data-wishlist-theme': undefined,
			'data-wishlist-background': 'custom',
			'data-wishlist-backdrop': '',
			'data-wishlist-dark-backdrop': '',
			'data-wishlist-placement': 'gutters',
		});
	});

	it('previews an unsaved local photo over the stored one', () => {
		const scope = resolveWishlistThemeScope({
			themeId: null,
			styleTokens: null,
			background: { mode: 'custom', imageKey: 'bg/old.webp' },
			previewImageUrl: 'blob:http://localhost/preview',
		});
		expect(scope.backgroundMode).toBe('custom');
		expect(scope.customImageUrl).toBe('blob:http://localhost/preview');
	});
});
