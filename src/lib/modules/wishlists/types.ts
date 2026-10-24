import * as v from 'valibot';
import type { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { WishlistImageSlotsSchema, type WishlistImageSlots } from '$lib/modules/images/types.js';
import { isPalette, type Palette } from '$lib/theme/palettes.js';
import { WISHLIST_THEME_IDS, type WishlistThemeId } from '$lib/theme/wishlist_themes.js';

/** Full wishlist row from DB */
export type Wishlist = typeof wishlist.$inferSelect;

/** Priority level row from DB */
export type PriorityLevel = typeof priorityLevel.$inferSelect;

export const WISHLIST_THEMES = [
	'default',
	'christmas',
	'birthday',
	'fun',
	'elegant',
	'custom',
] as const;

export type WishlistTheme = (typeof WISHLIST_THEMES)[number];

/** Default theme applied to a wishlist when none is chosen. */
export const DEFAULT_WISHLIST_THEME: WishlistTheme = 'default';

/** Whether a wishlist is for the creator (self) or for a free-text recipient (other). */
export const RECIPIENT_KIND = {
	self: 'self',
	other: 'other',
} as const;

export type RecipientKind = (typeof RECIPIENT_KIND)[keyof typeof RECIPIENT_KIND];

/**
 * An occasion wishlist follows the strict post-share gift rules; a permanent wishlist has no event
 * date and keeps its unreserved gifts fully editable after sharing (issue #479).
 */
export const WISHLIST_KIND = {
	occasion: 'occasion',
	permanent: 'permanent',
} as const;

export type WishlistKind = (typeof WISHLIST_KIND)[keyof typeof WISHLIST_KIND];

export const WISHLIST_KINDS = [WISHLIST_KIND.occasion, WISHLIST_KIND.permanent] as const;

/** Max length of a free-text recipient name (issue #99 creation modal). */
export const RECIPIENT_NAME_MAX_LENGTH = 100;

/** Max length of a wishlist title (issue #210: unbounded titles overflow dialog headers). */
export const WISHLIST_TITLE_MAX_LENGTH = 100;

/** Free-text recipient name: trimmed, non-empty, max {@link RECIPIENT_NAME_MAX_LENGTH} chars.
 *  Single source for creation, rename, and the linked → free-text flip (issue #150). */
const RecipientNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1),
	v.maxLength(RECIPIENT_NAME_MAX_LENGTH),
);

/** Wishlist title: trimmed, non-empty, max {@link WISHLIST_TITLE_MAX_LENGTH} chars.
 *  Single source for creation and update (issue #210). */
const WishlistTitleSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1),
	v.maxLength(WISHLIST_TITLE_MAX_LENGTH),
);

/**
 * Input for creating a new wishlist. Discriminated on `recipientKind`:
 * - `self`: the creator is the linked recipient (behaviourally identical to the old owner flow).
 * - `other`: a free-text recipient; the creator becomes the first správce (moderator).
 * The choice is immutable after creation — the server derives roles, never the client.
 */
export type CreateWishlistInput =
	| {
			recipientKind: 'self';
			title: string;
			kind?: WishlistKind;
			eventDate?: Date | null;
			theme?: WishlistTheme;
			palette?: Palette;
			/** Omitted: inferred from the title or event date; null: explicitly no theme. */
			themeId?: WishlistThemeId | null;
			description?: string | null;
	  }
	| {
			recipientKind: 'other';
			recipientName: string;
			title: string;
			kind?: WishlistKind;
			eventDate?: Date | null;
			theme?: WishlistTheme;
			palette?: Palette;
			/** Omitted: inferred from the title or event date; null: explicitly no theme. */
			themeId?: WishlistThemeId | null;
			description?: string | null;
	  };

/** Single valibot schema for a valid {@link Palette}, shared by create + set-palette inputs. */
const PaletteSchema = v.custom<Palette>(isPalette);

const CreateWishlistBaseFields = {
	title: WishlistTitleSchema,
	kind: v.optional(v.picklist(WISHLIST_KINDS)),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
	palette: v.optional(PaletteSchema),
	themeId: v.optional(v.nullable(v.picklist(WISHLIST_THEME_IDS))),
	description: v.optional(v.nullable(v.string())),
};

export const CreateWishlistInputSchema = v.variant('recipientKind', [
	v.object({ recipientKind: v.literal(RECIPIENT_KIND.self), ...CreateWishlistBaseFields }),
	v.object({
		recipientKind: v.literal(RECIPIENT_KIND.other),
		recipientName: RecipientNameSchema,
		...CreateWishlistBaseFields,
	}),
]);

/** Input for updating an existing wishlist */
export interface UpdateWishlistInput {
	id: string;
	title?: string;
	description?: string | null;
	eventDate?: Date | null;
	kind?: WishlistKind;
	imageKey?: string | null;
	imageSlots?: WishlistImageSlots | null;
	/** Upload proof, required only when assigning a newly uploaded non-null banner key. */
	imageAssignmentToken?: string;
}

export const UpdateWishlistInputSchema = v.object({
	id: v.string(),
	title: v.optional(WishlistTitleSchema),
	description: v.optional(v.nullable(v.string())),
	eventDate: v.optional(v.nullable(v.date())),
	kind: v.optional(v.picklist(WISHLIST_KINDS)),
	imageKey: v.optional(v.nullable(v.string())),
	imageSlots: v.optional(v.nullable(WishlistImageSlotsSchema)),
	imageAssignmentToken: v.optional(v.string()),
});

/**
 * Viewer's role relative to a wishlist.
 * - `recipient`: the person the list is FOR (linked user account). Manages the list but never
 *   sees reservation/gifter state and cannot reserve. Replaces the dissolved `owner` role.
 * - `moderator`: a správce — full management + full reservation visibility + can reserve.
 * - `visitor`: anyone else; sees reserved state but never gifter identity.
 */
export const WISHLIST_ROLES = {
	recipient: 'recipient',
	moderator: 'moderator',
	visitor: 'visitor',
} as const;

export type WishlistRole = (typeof WISHLIST_ROLES)[keyof typeof WISHLIST_ROLES];

/** Input for changing a wishlist's palette (Redesign 2026, issue #102). Validated via isPalette(). */
export const SetWishlistPaletteInputSchema = v.object({
	wishlistId: v.string(),
	palette: PaletteSchema,
});

/** Input for renaming a free-text recipient (správci only; for-someone lists only). */
export const RenameRecipientInputSchema = v.object({
	id: v.string(),
	recipientName: RecipientNameSchema,
});

/**
 * Input for flipping a linked recipient to a free-text recipient (issue #150, decision
 * 2026-07-14). Only the linked recipient may execute; `recipientName` becomes the new
 * free-text name (trimmed, non-empty, max 100 chars).
 */
export const FlipRecipientToFreeTextInputSchema = v.object({
	id: v.string(),
	recipientName: RecipientNameSchema,
});

/** Wishlist with computed viewer role */
export interface WishlistWithRole extends Wishlist {
	role: WishlistRole;
}

export const PRIORITY_LEVEL_LABEL_MAX_LENGTH = 80;

export const MAX_PRIORITY_LEVELS = 20;

/**
 * The complete ordered set of a wishlist's priority levels: listed levels keep their id (renamed
 * and reordered in place), levels without an id are added, and omitted levels are removed. At
 * least one level remains.
 */
export const SavePriorityLevelsInputSchema = v.strictObject({
	wishlistId: v.string(),
	levels: v.pipe(
		v.array(
			v.strictObject({
				id: v.nullable(v.string()),
				label: v.pipe(
					v.string(),
					v.trim(),
					v.minLength(1),
					v.maxLength(PRIORITY_LEVEL_LABEL_MAX_LENGTH),
				),
			}),
		),
		v.minLength(1),
		v.maxLength(MAX_PRIORITY_LEVELS),
	),
});

/** Default priority levels created with each wishlist */
export const DEFAULT_PRIORITY_LEVELS = [
	{ label: 'Vysoka', sortOrder: 1 },
	{ label: 'Stredni', sortOrder: 2 },
	{ label: 'Nizka', sortOrder: 3 },
] as const;
