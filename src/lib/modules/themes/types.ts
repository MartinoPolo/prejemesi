/** Theme preset names matching the DB enum */
export const THEME_PRESET_NAMES = {
	default: 'default',
	christmas: 'christmas',
	birthday: 'birthday',
	fun: 'fun',
	elegant: 'elegant',
} as const;

export type ThemePresetName = (typeof THEME_PRESET_NAMES)[keyof typeof THEME_PRESET_NAMES];

/** Custom theme defined by a single OKLCH base color */
export interface CustomTheme {
	color: string;
}

/** Resolved wishlist theme — either a preset name or a custom color */
export type WishlistTheme = ThemePresetName | CustomTheme;

/** CSS variables that define a wishlist theme palette */
export interface ThemePalette {
	'--wishlist-primary': string;
	'--wishlist-primary-fg': string;
	'--wishlist-accent': string;
	'--wishlist-accent-fg': string;
	'--wishlist-surface': string;
	'--wishlist-surface-hover': string;
	'--wishlist-border': string;
	'--wishlist-border-strong': string;
	'--wishlist-muted': string;
	'--wishlist-muted-fg': string;
}

/** All CSS variable keys in a theme palette */
export const THEME_PALETTE_KEYS = [
	'--wishlist-primary',
	'--wishlist-primary-fg',
	'--wishlist-accent',
	'--wishlist-accent-fg',
	'--wishlist-surface',
	'--wishlist-surface-hover',
	'--wishlist-border',
	'--wishlist-border-strong',
	'--wishlist-muted',
	'--wishlist-muted-fg',
] as const satisfies readonly (keyof ThemePalette)[];

/** Metadata for a theme preset (display info + palette) */
export interface ThemePresetDefinition {
	name: ThemePresetName;
	emoji: string;
	label: string;
	palette: ThemePalette;
	/** Gradient for preset card preview */
	gradient: string;
}

/** Helper to check if a WishlistTheme is a custom theme */
export function isCustomTheme(theme: WishlistTheme): theme is CustomTheme {
	return typeof theme === 'object' && 'color' in theme;
}

/** Convert DB fields to WishlistTheme */
export function toWishlistTheme(
	themePreset: string,
	customThemeColor: string | null,
): WishlistTheme {
	if (themePreset === 'custom' && customThemeColor !== null) {
		return { color: customThemeColor };
	}
	if (themePreset in THEME_PRESET_NAMES) {
		return themePreset as ThemePresetName;
	}
	return 'default';
}
