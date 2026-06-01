import * as v from 'valibot';
import type { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';

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

/** Input for creating a new wishlist */
export interface CreateWishlistInput {
	title: string;
	eventDate?: Date | null;
	theme?: WishlistTheme;
}

export const CreateWishlistInputSchema = v.object({
	title: v.string(),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
});

/** Input for updating an existing wishlist */
export interface UpdateWishlistInput {
	id: string;
	title?: string;
	description?: string | null;
	eventDate?: Date | null;
	theme?: WishlistTheme;
	customThemeColor?: string | null;
	bannerImageKey?: string | null;
	thumbnailImageKey?: string | null;
}

export const UpdateWishlistInputSchema = v.object({
	id: v.string(),
	title: v.optional(v.string()),
	description: v.optional(v.nullable(v.string())),
	eventDate: v.optional(v.nullable(v.date())),
	theme: v.optional(v.picklist(WISHLIST_THEMES)),
	customThemeColor: v.optional(v.nullable(v.string())),
	bannerImageKey: v.optional(v.nullable(v.string())),
	thumbnailImageKey: v.optional(v.nullable(v.string())),
});

/** Viewer's role relative to a wishlist */
export const WISHLIST_ROLES = {
	owner: 'owner',
	moderator: 'moderator',
	visitor: 'visitor',
} as const;

export type WishlistRole = (typeof WISHLIST_ROLES)[keyof typeof WISHLIST_ROLES];

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
