import * as v from 'valibot';
import type { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { WishlistImageSlotsSchema, type WishlistImageSlots } from '$lib/modules/images/types.js';
import { isPalette, type Palette } from '$lib/theme/palettes.js';

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

/** Max length of a free-text recipient name (issue #99 creation modal). */
export const RECIPIENT_NAME_MAX_LENGTH = 100;

/** Free-text recipient name: trimmed, non-empty, max {@link RECIPIENT_NAME_MAX_LENGTH} chars.
 *  Single source for creation, rename, and the linked → free-text flip (issue #150). */
const RecipientNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1),
	v.maxLength(RECIPIENT_NAME_MAX_LENGTH),
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
			eventDate?: Date | null;
			theme?: WishlistTheme;
			palette?: Palette;
			description?: string | null;
	  }
	| {
			recipientKind: 'other';
			recipientName: string;
			title: string;
			eventDate?: Date | null;
			theme?: WishlistTheme;
			palette?: Palette;
			description?: string | null;
	  };

/** Single valibot schema for a valid {@link Palette}, shared by create + set-palette inputs. */
const PaletteSchema = v.custom<Palette>(isPalette);

const CreateWishlistBaseFields = {
	title: v.pipe(v.string(), v.trim(), v.minLength(1)),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
	palette: v.optional(PaletteSchema),
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
	imageKey?: string | null;
	imageSlots?: WishlistImageSlots | null;
}

export const UpdateWishlistInputSchema = v.object({
	id: v.string(),
	title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
	description: v.optional(v.nullable(v.string())),
	eventDate: v.optional(v.nullable(v.date())),
	imageKey: v.optional(v.nullable(v.string())),
	imageSlots: v.optional(v.nullable(WishlistImageSlotsSchema)),
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

/** Default priority levels created with each wishlist */
export const DEFAULT_PRIORITY_LEVELS = [
	{ label: 'Vysoka', sortOrder: 1 },
	{ label: 'Stredni', sortOrder: 2 },
	{ label: 'Nizka', sortOrder: 3 },
] as const;
