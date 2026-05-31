import type { Wishlist } from './types.js';

interface ThemePreset {
	emoji: string;
	label: string;
	gradient: string;
}

export const WISHLIST_THEME_PRESETS = {
	default: {
		emoji: '🎁',
		label: 'Výchozí',
		gradient:
			'linear-gradient(145deg, oklch(0.48 0.12 150), oklch(0.56 0.14 145), oklch(0.42 0.1 155))',
	},
	christmas: {
		emoji: '🎄',
		label: 'Vánoce',
		gradient:
			'linear-gradient(145deg, oklch(0.24 0.07 155), oklch(0.18 0.05 165), oklch(0.28 0.09 148))',
	},
	birthday: {
		emoji: '🎂',
		label: 'Narozeniny',
		gradient:
			'linear-gradient(145deg, oklch(0.62 0.14 55), oklch(0.72 0.16 62), oklch(0.55 0.12 48))',
	},
	fun: {
		emoji: '🎉',
		label: 'Zábava',
		gradient:
			'linear-gradient(145deg, oklch(0.44 0.13 200), oklch(0.52 0.16 195), oklch(0.38 0.11 210))',
	},
	elegant: {
		emoji: '💍',
		label: 'Elegantní',
		gradient:
			'linear-gradient(145deg, oklch(0.36 0.03 260), oklch(0.44 0.04 255), oklch(0.3 0.02 265))',
	},
	custom: {
		emoji: '✨',
		label: 'Vlastní',
		gradient:
			'linear-gradient(145deg, oklch(0.42 0.12 275), oklch(0.52 0.15 268), oklch(0.36 0.1 282))',
	},
} as const satisfies Record<Wishlist['theme'], ThemePreset>;

export type WishlistTheme = keyof typeof WISHLIST_THEME_PRESETS;

export function getThemePreset(theme: WishlistTheme): ThemePreset {
	return WISHLIST_THEME_PRESETS[theme];
}
