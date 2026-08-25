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
	/**
	 * Stable client-only key for editor list reconciliation (reorder/remove without
	 * losing input focus). Never persisted – {@link normalizeGiftLinks} drops it.
	 */
	id?: string;
}

/** One immutable, timestamped post-share description segment (REQ-4). */
export interface DescriptionAppend {
	text: string;
	addedAt: string; // ISO timestamp
}

const GiftLinkSchema = v.object({
	url: v.pipe(v.string(), v.url()),
	label: v.optional(v.string()),
});

/** Up to {@link MAX_GIFT_LINKS} links; order is significant (index 0 = primary). */
const GiftLinksSchema = v.pipe(v.array(GiftLinkSchema), v.maxLength(MAX_GIFT_LINKS));

/**
 * Cross-field rule for the optional price range (issue #155 REQ-4): when both bounds are present
 * the upper bound may not sit below the lower bound. Either bound absent/null is always valid —
 * range mode's "both bounds required" rule is enforced client-side by the form, not the wire schema.
 */
export function isPriceRangeValid<T extends { price?: number | null; priceMax?: number | null }>(
	input: T,
): boolean {
	return (
		input.priceMax === undefined ||
		input.priceMax === null ||
		input.price === undefined ||
		input.price === null ||
		input.priceMax >= input.price
	);
}

/** Shared fields present in every gift view regardless of role. */
export interface GiftBase {
	id: string;
	wishlistId: string;
	name: string;
	description: string | null;
	descriptionAppends: DescriptionAppend[];
	editedAfterShareAt: Date | null;
	links: GiftLink[];
	price: number | null;
	/** Upper bound of a non-binding price range hint (issue #155). Null = single price (`price`). */
	priceMax: number | null;
	currency: string | null;
	imageUrl: string | null;
	imageKey: string | null;
	imageMeta: ImageMetadata | null;
	quantity: number | null;
	sortOrder: number;
	received: boolean;
	createdAt: Date;
	priorityLevelId: string | null;
	priorityLabel: string | null;
	prioritySortOrder: number | null;
}

/** Gift with computed fields for visitor/moderator view */
export interface GiftForVisitor extends GiftBase {
	likeCount: number;
	reservedCount: number;
	isFullyReserved: boolean;
	/**
	 * Display names of active reservers (account name, or the anonymous signature), in
	 * reservation order. Emitted to moderators only (issue #198); empty for every other
	 * viewer — visitors get the anonymous reserved state, and a self-promoted recipient
	 * sees counts only.
	 */
	reserverNames: string[];
	/** Active reservation id held by the current authenticated user for this gift, or null. */
	myReservationId: string | null;
	/** When the current user marked their reservation as bought (gifter-private), or null. */
	myReservationPurchasedAt: Date | null;
}

/** Gift for the recipient's view – no reservation data (protects the surprise) */
export type GiftForRecipient = GiftBase;

/** Union type for gift based on role */
export type GiftByRole = GiftForVisitor | GiftForRecipient;

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
	likedOnly: boolean;
	/** Received gifts are archived from ordinary browsing unless explicitly requested. */
	showReceived: boolean;
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

/**
 * Binary priority a draft carries before commit. Mapped to a concrete wishlist
 * priority level by rank at commit time (high → lowest sortOrder, medium → 2nd).
 */
export const DRAFT_PRIORITY = { high: 'high', medium: 'medium' } as const;

export type DraftPriority = (typeof DRAFT_PRIORITY)[keyof typeof DRAFT_PRIORITY];

/** Picklist-friendly tuple of priority values. */
export const DRAFT_PRIORITY_VALUES = [DRAFT_PRIORITY.high, DRAFT_PRIORITY.medium] as const;

/** Empty heart — every imported/batch row starts at medium until toggled high. */
export const DEFAULT_DRAFT_PRIORITY: DraftPriority = DRAFT_PRIORITY.medium;

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
	/** Upper bound of a non-binding price range hint (issue #155). Null = single price (`price`). */
	priceMax?: number | null;
	currency?: GiftCurrency | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	imageMeta?: ImageMetadata | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
}

export const GIFT_CURRENCY_VALUES = Object.values(GIFT_CURRENCIES);

/** Largest exact monetary value supported by the numeric(12,2) persistence columns. */
export const MAX_GIFT_PRICE = 9_999_999_999.99;

function hasAtMostTwoDecimalPlaces(value: number): boolean {
	const [coefficient, exponentText] = value.toString().toLowerCase().split('e');
	const fractionLength = coefficient.split('.')[1]?.length ?? 0;
	const exponent = exponentText === undefined ? 0 : Number(exponentText);
	return Math.max(0, fractionLength - exponent) <= 2;
}

/** Whether a price fits the finite, non-negative numeric(12,2) persistence contract. */
export function isValidGiftPrice(value: number): boolean {
	return (
		Number.isFinite(value) &&
		value >= 0 &&
		value <= MAX_GIFT_PRICE &&
		hasAtMostTwoDecimalPlaces(value)
	);
}

/** Shared persistence-safe monetary validation (finite, non-negative, and at most 2 decimals). */
export const GiftPriceSchema = v.pipe(
	v.number(),
	v.finite(),
	v.minValue(0),
	v.maxValue(MAX_GIFT_PRICE),
	v.check(isValidGiftPrice, 'price must have at most two decimal places'),
);

export const CreateGiftInputSchema = v.pipe(
	v.strictObject({
		wishlistId: v.string(),
		name: v.pipe(v.string(), v.trim(), v.minLength(1)),
		description: v.optional(v.nullable(v.string())),
		links: v.optional(v.nullable(GiftLinksSchema)),
		price: v.optional(v.nullable(GiftPriceSchema)),
		priceMax: v.optional(v.nullable(GiftPriceSchema)),
		currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
		imageUrl: v.optional(v.nullable(v.string())),
		imageKey: v.optional(v.nullable(v.string())),
		imageMeta: v.optional(v.nullable(ImageMetadataSchema)),
		quantity: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
		priorityLevelId: v.optional(v.nullable(v.string())),
	}),
	v.check(isPriceRangeValid, 'priceMax must be greater than or equal to price'),
);

/**
 * Wire shape of one import/batch draft committed into a real gift. Mirrors the
 * editable {@link GiftDraft} grid row minus DB-managed fields (wishlist and
 * sortOrder). `name` is required; everything else optional. `priority` is a
 * binary rank the server resolves to a concrete priority level at commit.
 */
export const GiftDraftInputSchema = v.pipe(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1)),
		description: v.optional(v.nullable(v.string())),
		links: v.optional(v.nullable(GiftLinksSchema)),
		price: v.optional(v.nullable(GiftPriceSchema)),
		priceMax: v.optional(v.nullable(GiftPriceSchema)),
		currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
		imageUrl: v.optional(
			v.nullable(
				v.pipe(
					v.string(),
					v.url(),
					v.check((url) => url.startsWith('https://'), 'imageUrl must use HTTPS'),
				),
			),
			null,
		),
		quantity: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
		priority: v.optional(v.picklist(DRAFT_PRIORITY_VALUES), DEFAULT_DRAFT_PRIORITY),
	}),
	v.check(isPriceRangeValid, 'priceMax must be greater than or equal to price'),
);

export type GiftDraftInput = v.InferOutput<typeof GiftDraftInputSchema>;

/**
 * Edit or delete one existing description append by index, within that segment's own grace
 * window (issue #83). `text: null` (or blank) deletes the segment; a non-blank `text` replaces it
 * and resets its `addedAt` (re-opening the segment's window). Mutually exclusive with appending a
 * new segment via {@link UpdateGiftInput.description}.
 */
export interface DescriptionAppendEdit {
	index: number;
	text: string | null;
}

/** Input for updating an existing gift */
export interface UpdateGiftInput {
	id: string;
	name?: string;
	description?: string | null;
	descriptionAppendEdit?: DescriptionAppendEdit;
	links?: GiftLink[] | null;
	price?: number | null;
	/** Upper bound of a non-binding price range hint (issue #155). Null = single price (`price`). */
	priceMax?: number | null;
	currency?: GiftCurrency | null;
	imageUrl?: string | null;
	imageKey?: string | null;
	imageMeta?: ImageMetadata | null;
	quantity?: number | null;
	priorityLevelId?: string | null;
}

export const UpdateGiftInputSchema = v.pipe(
	v.object({
		id: v.string(),
		name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
		description: v.optional(v.nullable(v.string())),
		descriptionAppendEdit: v.optional(
			v.object({
				index: v.pipe(v.number(), v.integer(), v.minValue(0)),
				text: v.nullable(v.string()),
			}),
		),
		links: v.optional(v.nullable(GiftLinksSchema)),
		price: v.optional(v.nullable(GiftPriceSchema)),
		priceMax: v.optional(v.nullable(GiftPriceSchema)),
		currency: v.optional(v.nullable(v.picklist(GIFT_CURRENCY_VALUES))),
		imageUrl: v.optional(v.nullable(v.string())),
		imageKey: v.optional(v.nullable(v.string())),
		imageMeta: v.optional(v.nullable(ImageMetadataSchema)),
		quantity: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
		priorityLevelId: v.optional(v.nullable(v.string())),
	}),
	v.check(isPriceRangeValid, 'priceMax must be greater than or equal to price'),
);

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
