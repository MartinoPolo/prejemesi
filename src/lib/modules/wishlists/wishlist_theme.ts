import { THEME_PRESETS } from '$lib/modules/themes/theme_presets.js';
import type { ThemePresetName } from '$lib/modules/themes/types.js';

/**
 * Type alias for backward compatibility with dashboard cards.
 * Includes 'custom' because the DB enum includes it.
 */
export type WishlistTheme = ThemePresetName | 'custom';

interface ThemePresetDisplay {
	emoji: string;
	label: string;
	gradient: string;
}

const CUSTOM_DISPLAY: ThemePresetDisplay = {
	emoji: '✨',
	label: 'Vlastni',
	gradient:
		'linear-gradient(145deg, oklch(0.42 0.12 275), oklch(0.52 0.15 268), oklch(0.36 0.1 282))',
};

/** Get display info for a theme preset. Used by dashboard cards. */
export function getThemePreset(theme: WishlistTheme): ThemePresetDisplay {
	if (theme === 'custom') {
		return CUSTOM_DISPLAY;
	}
	const preset = THEME_PRESETS[theme];
	return {
		emoji: preset.emoji,
		label: preset.label,
		gradient: preset.gradient,
	};
}
