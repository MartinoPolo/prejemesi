import * as v from 'valibot';
import type { gift, reservation, giftLike } from '$lib/server/db/gift.schema.js';
import type { priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { ImageMetadataSchema, type ImageMetadata } from '$lib/modules/images/types.js';

/** Full gift row from DB */
export type Gift = typeof gift.$inferSelect;

/** Reservation row from DB */
export type Reservation = typeof reservation.$inferSelect;

/** Gift like row from DB */
export type GiftLike = typeof giftLike.$inferSelect;

/** Priority level row from DB */
export type GiftPriorityLevel = typeof priorityLevel.$inferSelect;

/** Maximum number of links a gift can carry. `links[0]` is the primary link. */
export const MAX_GIFT_LINKS = 10;

/** A single purchase link on a gift. `label` defaults to the URL's domain when absent. */
export interface GiftLink {
	url: string;
	label?: string;
}

const GiftLinkSchema = v.object({
	url: v.pipe(v.string(), v.url()),
	label: v.optional(v.string()),
});

/** Up to {@link MAX_GIFT_LINKS} links; order is significant (index 0 = primary). */
const GiftLinksSchema = v.pipe(v.array(GiftLinkSchema), v.maxLength(MAX_GIFT_LINKS));

/** Shared fields present in every gift view regardless of role. */
export interface GiftBase {
	id: string;
	wishlistId: string;
	name: string;
	description: string | null;
	links: GiftLink[];
	price: number | null;
	currency: string | null;
	imageUrl: string | null;
	imageKey: string | null;
	imageMeta: ImageMetadata | null;
	quantity: number | null;
	sortOrder: number;
	received: boolean;
	createdAt: Date;
	priorityLabel: string | null;
	prioritySortOrder: number | null;
}

/** Gift with computed fields for visitor/moderator view */
export interface GiftForVisitor extends GiftBase {
	likeCount: number;
	reservedCount: number;
	isFullyReserved: boolean;
	/** Active reservation id held by the current authenticated user for this gift, or null. */
	myReservationId: string | null;
}

/** Gift for owner view — no reservation data */
export type GiftForOwner = GiftBase;

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

/** Default currency for new/parsed gifts when none is detected. */
export const DEFAULT_GIFT_CURRENCY: GiftCurrency = GIFT_CURRENCIES.CZK;

export const GIFT_CURRENCY_LABELS = {
	CZK: 'CZK (Kč)',
	EUR: 'EUR',
	USD: 'USD',
} as const satisfies Record<GiftCurrency, string>;

/** Input for creating a new gift */
export interface CreateGiftInput {
	wishlistId: string;
	name: string;
	description?: string | null;
	links?: GiftLink[] | null;
	price?: number | null;
	currency?: GiftCurrency | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	imageMeta?: ImageMetadata | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
	sortOrder?: number;
}

export const GIFT_CURRENCY_VALUES = Object.values(GIFT_CURRENCIES);

export const CreateGiftInputSchema = v.object({
	wishlistId: v.string(),
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	description: v.optional(v.nullable(v.string())),
	links: v.optional(v.nullable(GiftLinksSchema)),
	price: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))),
	currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
	imageUrl: v.optional(v.nullable(v.string())),
	imageKey: v.optional(v.nullable(v.string())),
	imageMeta: v.optional(v.nullable(ImageMetadataSchema)),
	quantity: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
	priorityLevelId: v.optional(v.nullable(v.string())),
	sortOrder: v.optional(v.number()),
});

/**
 * Wire shape of one import/batch draft committed into a real gift. Mirrors the
 * editable {@link GiftDraft} grid row minus DB-managed fields (wishlist, image,
 * quantity, priority, sortOrder). `name` is required; everything else optional.
 */
export const GiftDraftInputSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	description: v.optional(v.nullable(v.string())),
	links: v.optional(v.nullable(GiftLinksSchema)),
	price: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))),
	currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
});

export type GiftDraftInput = v.InferOutput<typeof GiftDraftInputSchema>;

/** Input for updating an existing gift */
export interface UpdateGiftInput {
	id: string;
	name?: string;
	description?: string | null;
	links?: GiftLink[] | null;
	price?: number | null;
	currency?: GiftCurrency | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	imageMeta?: ImageMetadata | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
}

export const UpdateGiftInputSchema = v.object({
	id: v.string(),
	name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
	description: v.optional(v.nullable(v.string())),
	links: v.optional(v.nullable(GiftLinksSchema)),
	price: v.optional(v.nullable(v.pipe(v.number(), v.minValue(0)))),
	currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
	imageUrl: v.optional(v.nullable(v.string())),
	imageKey: v.optional(v.nullable(v.string())),
	imageMeta: v.optional(v.nullable(ImageMetadataSchema)),
	quantity: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
	priorityLevelId: v.optional(v.nullable(v.string())),
});

/** Input for reordering gifts */
export interface ReorderGiftItem {
	id: string;
	sortOrder: number;
}

export const ReorderGiftItemSchema = v.object({
	id: v.string(),
	sortOrder: v.number(),
});

export const MarkGiftReceivedInputSchema = v.object({
	giftId: v.string(),
	received: v.boolean(),
});
