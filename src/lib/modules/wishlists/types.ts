import type { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';

/** Full wishlist row from DB */
export type Wishlist = typeof wishlist.$inferSelect;

/** Priority level row from DB */
export type PriorityLevel = typeof priorityLevel.$inferSelect;

/** Input for creating a new wishlist */
export interface CreateWishlistInput {
	title: string;
	eventDate?: Date | null;
	theme?: Wishlist['theme'];
}

/** Input for updating an existing wishlist */
export interface UpdateWishlistInput {
	id: string;
	title?: string;
	description?: string | null;
	eventDate?: Date | null;
	theme?: Wishlist['theme'];
	customThemeColor?: string | null;
	bannerImageKey?: string | null;
	thumbnailImageKey?: string | null;
}

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
