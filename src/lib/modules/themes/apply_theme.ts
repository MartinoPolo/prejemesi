import type { ThemePalette, WishlistTheme } from './types.js';
import { isCustomTheme, THEME_PALETTE_KEYS } from './types.js';
import { THEME_PRESETS } from './theme_presets.js';
import { deriveOklchPalette, toModeAwarePalette } from './oklch_palette.js';

/**
 * Resolve a WishlistTheme to a mode-aware ThemePalette.
 * For presets: looks up the predefined (light) palette.
 * For custom: derives the (light) palette from the OKLCH base color.
 * In both cases the light palette is wrapped into `light-dark()` values so the
 * applied theme renders dark surfaces in dark mode (and live-updates on toggle).
 * Returns null if the custom color is invalid.
 */
export function resolveThemePalette(theme: WishlistTheme): ThemePalette | null {
	if (isCustomTheme(theme)) {
		const light = deriveOklchPalette(theme.color);
		return light === null ? null : toModeAwarePalette(light);
	}
	return toModeAwarePalette(THEME_PRESETS[theme].palette);
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
