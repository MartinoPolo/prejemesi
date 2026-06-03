export const ACCENT_COLORS = [
	'moss',
	'amber',
	'gold',
	'coral',
	'rose',
	'fuchsia',
	'sage',
	'teal',
	'azure',
	'indigo',
	'plum',
	'bark',
] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

// Background theme values are owned by the settings domain module; re-exported here
// so existing component-side consumers keep a single theme import surface.
export {
	BACKGROUND_THEMES,
	type BackgroundTheme,
	isBackgroundTheme,
} from '$lib/modules/settings/types.js';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
