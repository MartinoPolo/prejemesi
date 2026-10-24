import type { Palette } from './palettes.js';

/**
 * Wishlist themes (#535): a theme is a curated preset of palette, decorative background and
 * default style tokens. Choosing one copies its palette into the wishlist palette; style token
 * overrides are stored apart from the theme id so a later theme redesign never overwrites
 * choices the manager made explicitly. Art and backdrops live in `wishlist_theme_art/` and
 * `wishlist_themes.css`, keyed by the same ids.
 */
export const WISHLIST_THEME_IDS = [
	'toys',
	'kids_clothes',
	'gamer',
	'minimal',
	'wedding',
	'christmas',
	'outdoor',
	'books',
	'baby',
	'retro',
	'party',
	'space',
	'music',
	'pets',
	'gourmet',
	'travel',
] as const;

export type WishlistThemeId = (typeof WISHLIST_THEME_IDS)[number];

export const WISHLIST_CORNER_STYLES = ['round', 'soft', 'sharp'] as const;
export const WISHLIST_BORDER_STYLES = ['bold', 'fine'] as const;
export const WISHLIST_IMAGE_MATS = ['dotted', 'white', 'black'] as const;
export const WISHLIST_HEADING_FONTS = ['playful', 'elegant', 'plain', 'hand'] as const;

export type WishlistCornerStyle = (typeof WISHLIST_CORNER_STYLES)[number];
export type WishlistBorderStyle = (typeof WISHLIST_BORDER_STYLES)[number];
export type WishlistImageMat = (typeof WISHLIST_IMAGE_MATS)[number];
export type WishlistHeadingFont = (typeof WISHLIST_HEADING_FONTS)[number];

export interface WishlistStyleTokens {
	corners: WishlistCornerStyle;
	border: WishlistBorderStyle;
	mat: WishlistImageMat;
	heading: WishlistHeadingFont;
}

/** Today's look: what a wishlist without a theme and without overrides renders. */
const DEFAULT_WISHLIST_STYLE: WishlistStyleTokens = {
	corners: 'round',
	border: 'bold',
	mat: 'dotted',
	heading: 'playful',
};

export const WISHLIST_BACKGROUND_MODES = ['theme', 'library', 'custom', 'none'] as const;
export const WISHLIST_BACKGROUND_PLACEMENTS = ['gutters', 'full'] as const;
export const WISHLIST_BACKGROUND_MOTIONS = ['subtle', 'off'] as const;

export type WishlistBackgroundMode = (typeof WISHLIST_BACKGROUND_MODES)[number];
export type WishlistBackgroundPlacement = (typeof WISHLIST_BACKGROUND_PLACEMENTS)[number];
export type WishlistBackgroundMotion = (typeof WISHLIST_BACKGROUND_MOTIONS)[number];

export const WISHLIST_BACKGROUND_DIM_MAX = 60;

export interface WishlistBackground {
	mode: WishlistBackgroundMode;
	/** R2 key of the custom upload; kept while another mode is selected so switching back is free. */
	imageKey: string | null;
	/** Id of the chosen curated library image (`wishlist_background_library.ts`). */
	libraryImageId: string | null;
	/** Percent 0–100, drives the mobile strip crop and the desktop anchoring. */
	focal: { x: number; y: number };
	placement: WishlistBackgroundPlacement;
	/** Percent 0–`WISHLIST_BACKGROUND_DIM_MAX`. */
	dim: number;
	motion: WishlistBackgroundMotion;
}

export const DEFAULT_WISHLIST_BACKGROUND: WishlistBackground = {
	mode: 'theme',
	imageKey: null,
	libraryImageId: null,
	focal: { x: 50, y: 50 },
	placement: 'gutters',
	dim: 20,
	motion: 'subtle',
};

export interface WishlistThemeDefinition {
	palette: Palette;
	style: WishlistStyleTokens;
	/** Dark-native backdrops look the same in light and dark mode and use black hard shadows. */
	darkBackdrop: boolean;
}

export const WISHLIST_THEMES: Record<WishlistThemeId, WishlistThemeDefinition> = {
	toys: {
		palette: 'sky',
		style: { corners: 'round', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: false,
	},
	kids_clothes: {
		palette: 'sakura',
		style: { corners: 'round', border: 'bold', mat: 'white', heading: 'hand' },
		darkBackdrop: false,
	},
	gamer: {
		palette: 'grape',
		style: { corners: 'soft', border: 'bold', mat: 'black', heading: 'plain' },
		darkBackdrop: true,
	},
	minimal: {
		palette: 'graphite',
		style: { corners: 'sharp', border: 'fine', mat: 'white', heading: 'plain' },
		darkBackdrop: false,
	},
	wedding: {
		palette: 'honey',
		style: { corners: 'soft', border: 'fine', mat: 'white', heading: 'elegant' },
		darkBackdrop: false,
	},
	christmas: {
		palette: 'ruby',
		style: { corners: 'round', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: true,
	},
	outdoor: {
		palette: 'matcha',
		style: { corners: 'soft', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: false,
	},
	books: {
		palette: 'ocean',
		style: { corners: 'soft', border: 'fine', mat: 'white', heading: 'elegant' },
		darkBackdrop: false,
	},
	baby: {
		palette: 'mint',
		style: { corners: 'round', border: 'fine', mat: 'dotted', heading: 'hand' },
		darkBackdrop: false,
	},
	retro: {
		palette: 'peach',
		style: { corners: 'round', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: false,
	},
	party: {
		palette: 'sakura',
		style: { corners: 'round', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: false,
	},
	space: {
		palette: 'sky',
		style: { corners: 'soft', border: 'bold', mat: 'black', heading: 'plain' },
		darkBackdrop: true,
	},
	music: {
		palette: 'ruby',
		style: { corners: 'soft', border: 'bold', mat: 'white', heading: 'plain' },
		darkBackdrop: false,
	},
	pets: {
		palette: 'honey',
		style: { corners: 'round', border: 'bold', mat: 'dotted', heading: 'playful' },
		darkBackdrop: false,
	},
	gourmet: {
		palette: 'peach',
		style: { corners: 'soft', border: 'fine', mat: 'white', heading: 'elegant' },
		darkBackdrop: false,
	},
	travel: {
		palette: 'ocean',
		style: { corners: 'round', border: 'bold', mat: 'white', heading: 'hand' },
		darkBackdrop: false,
	},
};

export function isWishlistThemeId(value: unknown): value is WishlistThemeId {
	return typeof value === 'string' && (WISHLIST_THEME_IDS as readonly string[]).includes(value);
}

/** Theme defaults merged under the manager's explicit overrides. */
export function resolveWishlistStyle(
	themeId: WishlistThemeId | null,
	overrides: Partial<WishlistStyleTokens> | null,
): WishlistStyleTokens {
	const base = themeId === null ? DEFAULT_WISHLIST_STYLE : WISHLIST_THEMES[themeId].style;
	return { ...base, ...overrides };
}

export function resolveWishlistBackground(
	background: Partial<WishlistBackground> | null,
): WishlistBackground {
	return { ...DEFAULT_WISHLIST_BACKGROUND, ...background };
}
