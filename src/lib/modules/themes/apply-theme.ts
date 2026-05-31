import type { ThemePalette, WishlistTheme } from './types.js';
import { isCustomTheme, THEME_PALETTE_KEYS } from './types.js';
import { THEME_PRESETS } from './theme-presets.js';
import { deriveOklchPalette } from './oklch-palette.js';

/**
 * Resolve a WishlistTheme to a ThemePalette.
 * For presets: looks up the predefined palette.
 * For custom: derives palette from the OKLCH base color.
 * Returns null if the custom color is invalid.
 */
export function resolveThemePalette(theme: WishlistTheme): ThemePalette | null {
	if (isCustomTheme(theme)) {
		return deriveOklchPalette(theme.color);
	}
	const preset = THEME_PRESETS[theme];
	return preset.palette;
}

/**
 * Apply wishlist theme CSS variables to an HTML element.
 * For presets: applies the preset's CSS variable set.
 * For custom: derives the palette from the custom color and applies it.
 */
export function applyWishlistTheme(element: HTMLElement, theme: WishlistTheme): void {
	const palette = resolveThemePalette(theme);
	if (palette === null) {
		removeWishlistTheme(element);
		return;
	}
	for (const key of THEME_PALETTE_KEYS) {
		element.style.setProperty(key, palette[key]);
	}
}

/**
 * Remove all wishlist theme CSS variables from an element, resetting to defaults.
 */
export function removeWishlistTheme(element: HTMLElement): void {
	for (const key of THEME_PALETTE_KEYS) {
		element.style.removeProperty(key);
	}
}
