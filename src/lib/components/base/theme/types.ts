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

export const BACKGROUND_THEMES = ['default', 'golden-hour', 'twilight'] as const;
export type BackgroundTheme = (typeof BACKGROUND_THEMES)[number];

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
