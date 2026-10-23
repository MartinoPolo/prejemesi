import * as v from 'valibot';
import {
	WISHLIST_BACKGROUND_DIM_MAX,
	WISHLIST_BACKGROUND_MODES,
	WISHLIST_BACKGROUND_MOTIONS,
	WISHLIST_BACKGROUND_PLACEMENTS,
	WISHLIST_BORDER_STYLES,
	WISHLIST_CORNER_STYLES,
	WISHLIST_HEADING_FONTS,
	WISHLIST_IMAGE_MATS,
	WISHLIST_THEME_IDS,
	isWishlistThemeId,
	type WishlistBackground,
	type WishlistStyleTokens,
	type WishlistThemeId,
} from '$lib/theme/wishlist_themes.js';

const PercentSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(100));

const STYLE_TOKEN_SCHEMAS = {
	corners: v.picklist(WISHLIST_CORNER_STYLES),
	border: v.picklist(WISHLIST_BORDER_STYLES),
	mat: v.picklist(WISHLIST_IMAGE_MATS),
	heading: v.picklist(WISHLIST_HEADING_FONTS),
} satisfies { [Token in keyof WishlistStyleTokens]: v.GenericSchema<WishlistStyleTokens[Token]> };

const BACKGROUND_FIELD_SCHEMAS = {
	mode: v.picklist(WISHLIST_BACKGROUND_MODES),
	imageKey: v.nullable(v.pipe(v.string(), v.minLength(1))),
	focal: v.strictObject({ x: PercentSchema, y: PercentSchema }),
	placement: v.picklist(WISHLIST_BACKGROUND_PLACEMENTS),
	dim: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(WISHLIST_BACKGROUND_DIM_MAX)),
	motion: v.picklist(WISHLIST_BACKGROUND_MOTIONS),
} satisfies { [Field in keyof WishlistBackground]: v.GenericSchema<WishlistBackground[Field]> };

/**
 * A wishlist appearance draft. The theme palette is not part of it: the settings palette field
 * carries the palette the editor copied from the chosen theme.
 */
export const WishlistAppearanceInputSchema = v.strictObject({
	themeId: v.nullable(v.picklist(WISHLIST_THEME_IDS)),
	styleTokens: v.nullable(v.partial(v.strictObject(STYLE_TOKEN_SCHEMAS))),
	background: v.nullable(v.strictObject(BACKGROUND_FIELD_SCHEMAS)),
	/** Upload proof, required only when assigning a newly uploaded background image key. */
	backgroundAssignmentToken: v.optional(v.string()),
});

export type WishlistAppearanceInput = v.InferOutput<typeof WishlistAppearanceInputSchema>;

export interface WishlistAppearance {
	themeId: WishlistThemeId | null;
	styleTokens: Partial<WishlistStyleTokens> | null;
	background: Partial<WishlistBackground> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keeps only the known fields whose stored value is still valid; null when none remain. */
function pickValidFields<Fields extends Record<string, v.GenericSchema>>(
	value: unknown,
	schemas: Fields,
): Partial<{ [Field in keyof Fields]: v.InferOutput<Fields[Field]> }> | null {
	if (!isRecord(value)) {
		return null;
	}
	const validFields: Partial<{ [Field in keyof Fields]: v.InferOutput<Fields[Field]> }> = {};
	for (const field of Object.keys(schemas) as (keyof Fields & string)[]) {
		const parsed = v.safeParse(schemas[field], value[field]);
		if (parsed.success) {
			validFields[field] = parsed.output;
		}
	}
	return Object.keys(validFields).length === 0 ? null : validFields;
}

/** The custom background upload a stored background references, kept even while unselected. */
export function wishlistBackgroundImageKey(storedBackground: unknown): string | null {
	return pickValidFields(storedBackground, BACKGROUND_FIELD_SCHEMAS)?.imageKey ?? null;
}

/**
 * Stored appearance read defensively: a theme or token value retired from the registry, or a
 * malformed JSON column, falls back to the default look instead of reaching the renderer.
 */
export function sanitizeWishlistAppearance(stored: {
	themeId: unknown;
	styleTokens: unknown;
	background: unknown;
}): WishlistAppearance {
	return {
		themeId: isWishlistThemeId(stored.themeId) ? stored.themeId : null,
		styleTokens: pickValidFields(stored.styleTokens, STYLE_TOKEN_SCHEMAS),
		background: pickValidFields(stored.background, BACKGROUND_FIELD_SCHEMAS),
	};
}
