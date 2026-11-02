import type {
	WishlistAppearance,
	WishlistAppearanceInput,
} from '$lib/modules/wishlists/wishlist_appearance.js';
import type { Palette } from '$lib/theme/palettes.js';
import {
	WISHLIST_THEMES,
	resolveWishlistBackground,
	resolveWishlistStyle,
	type WishlistBackground,
	type WishlistStyleTokens,
	type WishlistThemeId,
} from '$lib/theme/wishlist_themes.js';
import type { WishlistAppearancePreview } from './wishlist_theme_scope.js';

/**
 * The appearance settings draft (#535). Style overrides hold only the tokens the manager chose
 * explicitly; the background is always fully resolved so the editor can show every control.
 */
export interface WishlistAppearanceDraft {
	themeId: WishlistThemeId | null;
	styleOverrides: Partial<WishlistStyleTokens>;
	background: WishlistBackground;
}

/** What the settings save needs from the appearance tab; each part is sent only while dirty. */
export interface WishlistAppearanceEditorDraft {
	paletteDirty: boolean;
	palette: Palette;
	appearanceDirty: boolean;
	appearance: WishlistAppearanceInput;
}

type StyleToken = keyof WishlistStyleTokens;

export function createWishlistAppearanceDraft(saved: WishlistAppearance): WishlistAppearanceDraft {
	return {
		themeId: saved.themeId,
		styleOverrides: { ...saved.styleTokens },
		background: resolveWishlistBackground(saved.background),
	};
}

/** The look the draft renders: theme defaults merged under the overrides. */
export function draftStyle(draft: WishlistAppearanceDraft): WishlistStyleTokens {
	return resolveWishlistStyle(draft.themeId, draft.styleOverrides);
}

function hasStyleOverrides(draft: WishlistAppearanceDraft): boolean {
	return Object.keys(draft.styleOverrides).length > 0;
}

function hasSelectedPhoto(background: WishlistBackground): boolean {
	return (
		(background.mode === 'custom' && background.imageKey !== null) ||
		(background.mode === 'library' && background.libraryImageId !== null)
	);
}

/**
 * Choosing a theme restyles the list as a whole: its palette is copied into the palette draft,
 * style overrides reset to the theme defaults and its backdrop is shown, except that a selected
 * custom or library photo stays. Without a theme there is no theme backdrop to show.
 */
export function selectWishlistTheme(
	draft: WishlistAppearanceDraft,
	themeId: WishlistThemeId | null,
): { draft: WishlistAppearanceDraft; palette: Palette | null } {
	const nextMode = hasSelectedPhoto(draft.background)
		? draft.background.mode
		: themeId === null
			? 'none'
			: 'theme';
	return {
		draft: {
			themeId,
			styleOverrides: {},
			background: { ...draft.background, mode: nextMode },
		},
		palette: themeId === null ? null : WISHLIST_THEMES[themeId].palette,
	};
}

/** Stores a token only while it differs from the theme default, so theme defaults stay live. */
export function setWishlistStyleToken<Token extends StyleToken>(
	draft: WishlistAppearanceDraft,
	token: Token,
	value: WishlistStyleTokens[Token],
): WishlistAppearanceDraft {
	const styleOverrides = { ...draft.styleOverrides };
	if (resolveWishlistStyle(draft.themeId, null)[token] === value) {
		delete styleOverrides[token];
	} else {
		styleOverrides[token] = value;
	}
	return { ...draft, styleOverrides };
}

/**
 * The parts of a motif the Vzhled editor lets the manager customize ("Přizpůsobit motiv"): Barva,
 * Pozadí, Hlavička and Styl. Each comes from the motif until the manager overrides it.
 */
export const WISHLIST_MOTIF_FIELDS = ['palette', 'background', 'heroFrame', 'style'] as const;

export type WishlistMotifField = (typeof WISHLIST_MOTIF_FIELDS)[number];

/** Tokens of the Styl field; the hero frame is its own Hlavička field. */
const STYLE_FIELD_TOKENS = ['corners', 'border', 'mat', 'heading'] as const satisfies StyleToken[];

/**
 * Whether a field no longer comes from the motif. The palette is copied from the motif on choice,
 * so it counts as the motif's while it equals the motif palette; the background while it shows
 * the motif backdrop; style fields while an override is stored, even one equal to the motif
 * default, so a stored choice keeps its meaning. Without a motif nothing comes from one.
 */
export function isMotifFieldOverridden(
	draft: WishlistAppearanceDraft,
	palette: Palette,
	field: WishlistMotifField,
): boolean {
	if (draft.themeId === null) {
		return false;
	}
	switch (field) {
		case 'palette':
			return palette !== WISHLIST_THEMES[draft.themeId].palette;
		case 'background':
			return draft.background.mode !== 'theme';
		case 'heroFrame':
			return draft.styleOverrides.heroFrame !== undefined;
		case 'style':
			return STYLE_FIELD_TOKENS.some((token) => draft.styleOverrides[token] !== undefined);
	}
}

function withoutStyleOverrides(
	draft: WishlistAppearanceDraft,
	tokens: readonly StyleToken[],
): WishlistAppearanceDraft {
	const styleOverrides = { ...draft.styleOverrides };
	for (const token of tokens) {
		delete styleOverrides[token];
	}
	return { ...draft, styleOverrides };
}

/**
 * Lets the motif supply a field again: its overrides are removed, the motif backdrop shows (a
 * stored custom upload stays referenced, so switching back is free) or the palette returns to the
 * motif palette, which the caller applies. Without a motif there is nothing to return to.
 */
export function resetMotifField(
	draft: WishlistAppearanceDraft,
	field: WishlistMotifField,
): { draft: WishlistAppearanceDraft; palette: Palette | null } {
	if (draft.themeId === null) {
		return { draft, palette: null };
	}
	switch (field) {
		case 'palette':
			return { draft, palette: WISHLIST_THEMES[draft.themeId].palette };
		case 'background':
			return { draft: setWishlistBackground(draft, { mode: 'theme' }), palette: null };
		case 'heroFrame':
			return { draft: withoutStyleOverrides(draft, ['heroFrame']), palette: null };
		case 'style':
			return { draft: withoutStyleOverrides(draft, STYLE_FIELD_TOKENS), palette: null };
	}
}

export function setWishlistBackground(
	draft: WishlistAppearanceDraft,
	changes: Partial<WishlistBackground>,
): WishlistAppearanceDraft {
	return { ...draft, background: { ...draft.background, ...changes } };
}

function sameStyleOverrides(
	first: Partial<WishlistStyleTokens>,
	second: Partial<WishlistStyleTokens>,
): boolean {
	const tokens = new Set([...Object.keys(first), ...Object.keys(second)]) as Set<StyleToken>;
	return [...tokens].every((token) => first[token] === second[token]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Field values compared by value one level deep, so nested points like `focal` count by content. */
function sameFieldValue(first: unknown, second: unknown): boolean {
	if (!isPlainRecord(first) || !isPlainRecord(second)) {
		return first === second;
	}
	const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
	return [...keys].every((key) => first[key] === second[key]);
}

function sameBackground(first: WishlistBackground, second: WishlistBackground): boolean {
	const fields = new Set([...Object.keys(first), ...Object.keys(second)]) as Set<
		keyof WishlistBackground
	>;
	return [...fields].every((field) => sameFieldValue(first[field], second[field]));
}

export function isSameWishlistAppearanceDraft(
	first: WishlistAppearanceDraft,
	second: WishlistAppearanceDraft,
): boolean {
	return (
		first.themeId === second.themeId &&
		sameStyleOverrides(first.styleOverrides, second.styleOverrides) &&
		sameBackground(first.background, second.background)
	);
}

/** The draft's look as stored: copies, so a payload or preview never aliases the draft. */
function draftLook(draft: WishlistAppearanceDraft): {
	styleTokens: Partial<WishlistStyleTokens> | null;
	background: WishlistBackground;
} {
	return {
		styleTokens: hasStyleOverrides(draft) ? { ...draft.styleOverrides } : null,
		background: { ...draft.background, focal: { ...draft.background.focal } },
	};
}

/**
 * The save payload. An unchanged background image key is omitted so the server keeps the stored
 * upload; a removed one is null; a new upload carries its assignment proof.
 */
export function wishlistAppearanceDraftToInput(
	draft: WishlistAppearanceDraft,
	savedImageKey: string | null,
	backgroundAssignmentToken?: string,
): WishlistAppearanceInput {
	const { styleTokens, background } = draftLook(draft);
	const { imageKey, ...backgroundFields } = background;
	const isNewUpload = imageKey !== null && imageKey !== savedImageKey;
	return {
		themeId: draft.themeId,
		styleTokens,
		background: {
			...backgroundFields,
			...(imageKey === savedImageKey ? {} : { imageKey }),
		},
		...(isNewUpload && backgroundAssignmentToken !== undefined
			? { backgroundAssignmentToken }
			: {}),
	};
}

export function wishlistAppearanceDraftToPreview(
	draft: WishlistAppearanceDraft,
	previewImageUrl?: string,
): WishlistAppearancePreview {
	return {
		themeId: draft.themeId,
		...draftLook(draft),
		...(previewImageUrl === undefined ? {} : { previewImageUrl }),
	};
}
