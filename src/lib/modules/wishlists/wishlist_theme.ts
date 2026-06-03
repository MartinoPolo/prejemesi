import * as m from '$lib/paraglide/messages.js';
import { THEME_PRESETS } from '$lib/modules/themes/theme_presets.js';
import type { ThemePresetName } from '$lib/modules/themes/types.js';

/**
 * Theme identifier for dashboard cards. Named distinctly from the `themes`
 * module's `WishlistTheme` to avoid a collision at import sites. Includes
 * 'custom' because the DB enum includes it.
 */
export type DashboardWishlistTheme = ThemePresetName | 'custom';

interface ThemePresetDisplay {
	emoji: string;
	label: string;
	gradient: string;
}

/** Get display info for a theme preset. Used by dashboard cards. */
export function getThemePreset(theme: DashboardWishlistTheme): ThemePresetDisplay {
	if (theme === 'custom') {
		return {
			emoji: '✨',
			label: m.theme_custom(),
			gradient:
				'linear-gradient(145deg, oklch(0.42 0.12 275), oklch(0.52 0.15 268), oklch(0.36 0.1 282))',
		};
	}
	const preset = THEME_PRESETS[theme];
	if (preset === undefined) {
		return { emoji: '🎁', label: 'Vychozi', gradient: THEME_PRESETS.default.gradient };
	}
	return {
		emoji: preset.emoji,
		label: preset.label(),
		gradient: preset.gradient,
	};
}
