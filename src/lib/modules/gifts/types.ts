import type { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import type { priorityLevel } from '$lib/server/db/wishlist.schema.js';

/** Full gift row from DB */
export type Gift = typeof gift.$inferSelect;

/** Reservation row from DB */
export type Reservation = typeof reservation.$inferSelect;

/** Gift like row from DB */
export type GiftLike = typeof giftLike.$inferSelect;

/** Priority level row from DB */
export type GiftPriorityLevel = typeof priorityLevel.$inferSelect;

/** Gift with computed fields for visitor/moderator view */
export interface GiftForVisitor {
	id: string;
	wishlistId: string;
	name: string;
	description: string | null;
	url: string | null;
	price: number | null;
	currency: string | null;
	imageUrl: string | null;
	quantity: number | null;
	sortOrder: number;
	received: boolean;
	createdAt: Date;
	priorityLabel: string | null;
	prioritySortOrder: number | null;
	likeCount: number;
	reservedCount: number;
	isFullyReserved: boolean;
}

/** Gift for owner view — no reservation data */
export interface GiftForOwner {
	id: string;
	wishlistId: string;
	name: string;
	description: string | null;
	url: string | null;
	price: number | null;
	currency: string | null;
	imageUrl: string | null;
	quantity: number | null;
	sortOrder: number;
	received: boolean;
	createdAt: Date;
	priorityLabel: string | null;
	prioritySortOrder: number | null;
}

/** Union type for gift based on role */
export type GiftByRole = GiftForVisitor | GiftForOwner;

/** View mode for gift display */
export const GIFT_VIEW_MODES = {
	card: 'card',
	list: 'list',
	compact: 'compact',
} as const;

export type GiftViewMode = (typeof GIFT_VIEW_MODES)[keyof typeof GIFT_VIEW_MODES];

/** Sort options for gifts */
export const GIFT_SORT_OPTIONS = {
	ownerOrder: 'ownerOrder',
	priority: 'priority',
	priceAsc: 'priceAsc',
	priceDesc: 'priceDesc',
	name: 'name',
	dateAdded: 'dateAdded',
} as const;

export type GiftSortOption = (typeof GIFT_SORT_OPTIONS)[keyof typeof GIFT_SORT_OPTIONS];

/** Filter options for gifts */
export interface GiftFilters {
	availableOnly: boolean;
	withLinkOnly: boolean;
}

/** Supported currencies */
export const GIFT_CURRENCIES = {
	CZK: 'CZK',
	EUR: 'EUR',
	USD: 'USD',
} as const;

export type GiftCurrency = (typeof GIFT_CURRENCIES)[keyof typeof GIFT_CURRENCIES];

export const GIFT_CURRENCY_LABELS = {
	CZK: 'CZK (Kc)',
	EUR: 'EUR',
	USD: 'USD',
} as const satisfies Record<GiftCurrency, string>;

/** Input for creating a new gift */
export interface CreateGiftInput {
	wishlistId: string;
	name: string;
	description?: string | null;
	url?: string | null;
	price?: number | null;
	currency?: string | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
	sortOrder?: number;
}

/** Input for updating an existing gift */
export interface UpdateGiftInput {
	id: string;
	name?: string;
	description?: string | null;
	url?: string | null;
	price?: number | null;
	currency?: string | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
}

/** Input for reordering gifts */
export interface ReorderGiftItem {
	id: string;
	sortOrder: number;
}
