import type { ThemePresetDefinition, ThemePalette, ThemePresetName } from './types.js';

const DEFAULT_PALETTE: ThemePalette = {
	'--wishlist-primary': 'oklch(0.527 0.154 150)',
	'--wishlist-primary-fg': 'oklch(0.982 0.018 156)',
	'--wishlist-accent': 'oklch(0.62 0.12 145)',
	'--wishlist-accent-fg': 'oklch(0.98 0.01 150)',
	'--wishlist-surface': 'oklch(0.985 0.005 150)',
	'--wishlist-surface-hover': 'oklch(0.97 0.01 150)',
	'--wishlist-border': 'oklch(0.93 0.007 107)',
	'--wishlist-border-strong': 'oklch(0.87 0.015 107)',
	'--wishlist-muted': 'oklch(0.966 0.005 107)',
	'--wishlist-muted-fg': 'oklch(0.58 0.031 107)',
};

const CHRISTMAS_PALETTE: ThemePalette = {
	'--wishlist-primary': 'oklch(0.50 0.18 25)',
	'--wishlist-primary-fg': 'oklch(0.98 0.01 25)',
	'--wishlist-accent': 'oklch(0.52 0.14 145)',
	'--wishlist-accent-fg': 'oklch(0.98 0.01 145)',
	'--wishlist-surface': 'oklch(0.985 0.008 25)',
	'--wishlist-surface-hover': 'oklch(0.97 0.015 25)',
	'--wishlist-border': 'oklch(0.92 0.02 25)',
	'--wishlist-border-strong': 'oklch(0.85 0.04 25)',
	'--wishlist-muted': 'oklch(0.965 0.01 25)',
	'--wishlist-muted-fg': 'oklch(0.55 0.06 25)',
};

const BIRTHDAY_PALETTE: ThemePalette = {
	'--wishlist-primary': 'oklch(0.58 0.18 330)',
	'--wishlist-primary-fg': 'oklch(0.98 0.01 330)',
	'--wishlist-accent': 'oklch(0.55 0.15 290)',
	'--wishlist-accent-fg': 'oklch(0.98 0.01 290)',
	'--wishlist-surface': 'oklch(0.985 0.01 330)',
	'--wishlist-surface-hover': 'oklch(0.97 0.018 330)',
	'--wishlist-border': 'oklch(0.92 0.025 330)',
	'--wishlist-border-strong': 'oklch(0.85 0.05 330)',
	'--wishlist-muted': 'oklch(0.965 0.012 330)',
	'--wishlist-muted-fg': 'oklch(0.55 0.07 330)',
};

const FUN_PALETTE: ThemePalette = {
	'--wishlist-primary': 'oklch(0.60 0.16 250)',
	'--wishlist-primary-fg': 'oklch(0.98 0.01 250)',
	'--wishlist-accent': 'oklch(0.72 0.16 65)',
	'--wishlist-accent-fg': 'oklch(0.25 0.03 65)',
	'--wishlist-surface': 'oklch(0.985 0.008 250)',
	'--wishlist-surface-hover': 'oklch(0.97 0.015 250)',
	'--wishlist-border': 'oklch(0.92 0.02 250)',
	'--wishlist-border-strong': 'oklch(0.85 0.04 250)',
	'--wishlist-muted': 'oklch(0.965 0.01 250)',
	'--wishlist-muted-fg': 'oklch(0.55 0.06 250)',
};

const ELEGANT_PALETTE: ThemePalette = {
	'--wishlist-primary': 'oklch(0.35 0.05 260)',
	'--wishlist-primary-fg': 'oklch(0.92 0.03 85)',
	'--wishlist-accent': 'oklch(0.72 0.12 85)',
	'--wishlist-accent-fg': 'oklch(0.25 0.03 85)',
	'--wishlist-surface': 'oklch(0.98 0.005 85)',
	'--wishlist-surface-hover': 'oklch(0.96 0.01 85)',
	'--wishlist-border': 'oklch(0.90 0.015 85)',
	'--wishlist-border-strong': 'oklch(0.82 0.03 85)',
	'--wishlist-muted': 'oklch(0.955 0.008 85)',
	'--wishlist-muted-fg': 'oklch(0.50 0.04 260)',
};

export const THEME_PRESETS = {
	default: {
		name: 'default',
		emoji: '🎁',
		label: 'Vychozi',
		palette: DEFAULT_PALETTE,
		gradient:
			'linear-gradient(145deg, oklch(0.48 0.12 150), oklch(0.56 0.14 145), oklch(0.42 0.1 155))',
	},
	christmas: {
		name: 'christmas',
		emoji: '🎄',
		label: 'Vanoce',
		palette: CHRISTMAS_PALETTE,
		gradient:
			'linear-gradient(145deg, oklch(0.45 0.15 25), oklch(0.50 0.14 145), oklch(0.65 0.12 85))',
	},
	birthday: {
		name: 'birthday',
		emoji: '🎂',
		label: 'Narozeniny',
		palette: BIRTHDAY_PALETTE,
		gradient:
			'linear-gradient(145deg, oklch(0.55 0.16 330), oklch(0.50 0.14 290), oklch(0.65 0.12 85))',
	},
	fun: {
		name: 'fun',
		emoji: '🎉',
		label: 'Zabava',
		palette: FUN_PALETTE,
		gradient:
			'linear-gradient(145deg, oklch(0.55 0.14 250), oklch(0.70 0.16 65), oklch(0.65 0.15 45))',
	},
	elegant: {
		name: 'elegant',
		emoji: '💍',
		label: 'Elegantni',
		palette: ELEGANT_PALETTE,
		gradient:
			'linear-gradient(145deg, oklch(0.30 0.04 260), oklch(0.40 0.05 255), oklch(0.70 0.10 85))',
	},
} as const satisfies Record<ThemePresetName, ThemePresetDefinition>;

/** Ordered array of all preset names for rendering */
export const THEME_PRESET_LIST = [
	'default',
	'christmas',
	'birthday',
	'fun',
	'elegant',
] as const satisfies readonly ThemePresetName[];
