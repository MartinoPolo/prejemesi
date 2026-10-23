import type { WishlistAppearance } from '$lib/modules/wishlists/wishlist_appearance.js';
import { imagePublicUrl } from '$lib/modules/images/public_url.js';
import {
	WISHLIST_THEMES,
	resolveWishlistBackground,
	resolveWishlistStyle,
	type WishlistBackground,
	type WishlistBackgroundMode,
	type WishlistStyleTokens,
	type WishlistThemeId,
} from '$lib/theme/wishlist_themes.js';

/**
 * An unsaved appearance the settings editor previews on the page (#535). `previewImageUrl` is a
 * local object URL for a custom background that is not uploaded yet; it wins over `imageKey`.
 */
export interface WishlistAppearancePreview extends WishlistAppearance {
	previewImageUrl?: string;
}

/** A theme motif for no-image placeholders; `markup` is null while the theme art loads. */
export interface WishlistThemeMotif {
	themeId: WishlistThemeId;
	markup: string | null;
}

/** What the wishlist subtree renders for one appearance. */
export interface WishlistThemeScope {
	/** Theme whose backdrop and art paint the page; null unless the theme backdrop is shown. */
	backdropThemeId: WishlistThemeId | null;
	/** Theme whose first motif replaces the no-image placeholders; null without a theme. */
	placeholderThemeId: WishlistThemeId | null;
	/** The backdrop actually rendered: a theme without art or a custom mode without an image is none. */
	backgroundMode: WishlistBackgroundMode;
	background: WishlistBackground;
	/** Resolved custom background URL, only while the custom backdrop is rendered. */
	customImageUrl: string | null;
	style: WishlistStyleTokens;
	/** Dark backdrops (dark-native themes, custom photos) switch the hard shadow to black. */
	darkBackdrop: boolean;
}

export function resolveWishlistThemeScope(
	appearance: WishlistAppearancePreview,
): WishlistThemeScope {
	const background = resolveWishlistBackground(appearance.background);
	const { themeId } = appearance;
	const customImageUrl =
		appearance.previewImageUrl ??
		(background.imageKey === null ? null : imagePublicUrl(background.imageKey));
	const backgroundMode = renderedBackgroundMode(background.mode, themeId, customImageUrl);
	return {
		backdropThemeId: backgroundMode === 'theme' ? themeId : null,
		placeholderThemeId: themeId,
		backgroundMode,
		background,
		customImageUrl: backgroundMode === 'custom' ? customImageUrl : null,
		style: resolveWishlistStyle(themeId, appearance.styleTokens),
		darkBackdrop:
			backgroundMode === 'custom' ||
			(backgroundMode === 'theme' &&
				themeId !== null &&
				WISHLIST_THEMES[themeId].darkBackdrop),
	};
}

function renderedBackgroundMode(
	mode: WishlistBackgroundMode,
	themeId: WishlistThemeId | null,
	customImageUrl: string | null,
): WishlistBackgroundMode {
	if (mode === 'theme' && themeId !== null) {
		return 'theme';
	}
	if (mode === 'custom' && customImageUrl !== null) {
		return 'custom';
	}
	return 'none';
}

/** Page-shell attributes that scope the theme to the wishlist subtree (see `wishlist_scope.css`). */
export function wishlistThemeScopeAttributes(scope: WishlistThemeScope) {
	const hasBackdrop = scope.backgroundMode !== 'none';
	return {
		'data-wishlist-theme': scope.backdropThemeId ?? undefined,
		'data-wishlist-background': scope.backgroundMode,
		'data-wishlist-backdrop': hasBackdrop ? '' : undefined,
		'data-wishlist-dark-backdrop': scope.darkBackdrop ? '' : undefined,
		'data-wishlist-placement':
			scope.backgroundMode === 'custom' ? scope.background.placement : undefined,
		...wishlistStyleTokenAttributes(scope.style),
	};
}

/** Style-token attributes alone, for wishlist surfaces that show the list's look without a backdrop. */
export function wishlistStyleTokenAttributes(style: WishlistStyleTokens) {
	return {
		'data-corners': style.corners,
		'data-border': style.border,
		'data-mat': style.mat,
		'data-heading': style.heading,
	};
}
