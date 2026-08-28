import {
	GIFT_GROUPING_OPTIONS,
	GIFT_SORT_OPTIONS,
	type GiftByRole,
	type GiftForRecipient,
	type GiftGroupingOption,
	type GiftSortOption,
} from './types.js';
import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
import { getPriorityKey, type PriorityKey } from './gift_display.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

export const GIFT_SECTION_KINDS = {
	ownReservation: 'ownReservation',
	available: 'available',
	otherGifts: 'otherGifts',
	reserved: 'reserved',
	priorityGroup: 'priorityGroup',
	noPriority: 'noPriority',
	categoryGroup: 'categoryGroup',
	uncategorized: 'uncategorized',
	received: 'received',
} as const;

export type GiftSectionKind = (typeof GIFT_SECTION_KINDS)[keyof typeof GIFT_SECTION_KINDS];

export interface GiftSection {
	kind: GiftSectionKind;
	key: string;
	label: string | null;
	priorityKey?: PriorityKey | null;
	gifts: GiftByRole[];
}

export function effectiveGiftPresentationRole(
	actualRole: WishlistRole,
	recipientViewPreview: boolean,
): WishlistRole {
	return recipientViewPreview ? WISHLIST_ROLES.recipient : actualRole;
}

export function projectGiftForRecipient(gift: GiftByRole): GiftForRecipient {
	return {
		id: gift.id,
		wishlistId: gift.wishlistId,
		name: gift.name,
		description: gift.description,
		descriptionAppends: gift.descriptionAppends,
		editedAfterShareAt: gift.editedAfterShareAt,
		links: gift.links,
		price: gift.price,
		priceMax: gift.priceMax,
		currency: gift.currency,
		imageUrl: gift.imageUrl,
		imageKey: gift.imageKey,
		imageMeta: gift.imageMeta,
		quantity: gift.quantity,
		sortOrder: gift.sortOrder,
		received: gift.received,
		createdAt: gift.createdAt,
		priorityLevelId: gift.priorityLevelId,
		priorityLabel: gift.priorityLabel,
		prioritySortOrder: gift.prioritySortOrder,
		categoryId: gift.categoryId ?? null,
		category: gift.category ?? null,
	};
}

export function projectGiftsForRecipient(gifts: readonly GiftByRole[]): GiftForRecipient[] {
	return gifts.map(projectGiftForRecipient);
}

export function activeGiftsInOwnerOrder(gifts: readonly GiftByRole[]): GiftByRole[] {
	return gifts
		.filter((gift) => !gift.received)
		.toSorted((firstGift, secondGift) => firstGift.sortOrder - secondGift.sortOrder);
}

export function resolveActiveGiftOrder(
	gifts: readonly GiftByRole[],
	orderedActiveIds: readonly string[],
): GiftByRole[] {
	const activeGifts = activeGiftsInOwnerOrder(gifts);
	const giftsById = new Map(activeGifts.map((gift) => [gift.id, gift]));
	const resolved = orderedActiveIds.flatMap((id) => {
		const gift = giftsById.get(id);
		if (gift === undefined) {
			return [];
		}
		giftsById.delete(id);
		return [gift];
	});

	return [...resolved, ...activeGifts.filter((gift) => giftsById.has(gift.id))];
}

export function giftSectionHasHeader(section: GiftSection): boolean {
	return (
		section.kind !== GIFT_SECTION_KINDS.available &&
		section.kind !== GIFT_SECTION_KINDS.reserved
	);
}

function isOwnReservation(gift: GiftByRole): boolean {
	return 'myReservationId' in gift && gift.myReservationId !== null;
}

function isFullyReserved(gift: GiftByRole): boolean {
	return 'isFullyReserved' in gift && gift.isFullyReserved;
}

export function computeUnprioritizedRank(gifts: readonly GiftByRole[]): number {
	let maxSortOrder: number | null = null;
	for (const gift of gifts) {
		if (gift.prioritySortOrder !== null) {
			maxSortOrder =
				maxSortOrder === null
					? gift.prioritySortOrder
					: Math.max(maxSortOrder, gift.prioritySortOrder);
		}
	}
	return maxSortOrder === null ? 0 : maxSortOrder + 1;
}

export function sortGifts(
	gifts: readonly GiftByRole[],
	sortOption: GiftSortOption,
	locale: string,
): GiftByRole[] {
	const result = [...gifts];
	const unprioritizedRank = computeUnprioritizedRank(gifts);
	result.sort((a, b) => {
		let comparison: number;
		switch (sortOption) {
			case GIFT_SORT_OPTIONS.ownerOrder:
				comparison = a.sortOrder - b.sortOrder;
				break;
			case GIFT_SORT_OPTIONS.priority: {
				const aPriority = a.prioritySortOrder ?? unprioritizedRank;
				const bPriority = b.prioritySortOrder ?? unprioritizedRank;
				comparison = aPriority - bPriority;
				break;
			}
			case GIFT_SORT_OPTIONS.priceAsc: {
				const aPrice = a.price ?? Number.MAX_SAFE_INTEGER;
				const bPrice = b.price ?? Number.MAX_SAFE_INTEGER;
				comparison = aPrice - bPrice;
				break;
			}
			case GIFT_SORT_OPTIONS.priceDesc: {
				const aPrice = a.price ?? -1;
				const bPrice = b.price ?? -1;
				comparison = bPrice - aPrice;
				break;
			}
			case GIFT_SORT_OPTIONS.name:
				comparison = a.name.localeCompare(b.name, locale);
				break;
			case GIFT_SORT_OPTIONS.dateAdded:
				comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
				break;
			default:
				comparison = 0;
		}
		return comparison || a.sortOrder - b.sortOrder;
	});
	return result;
}

function section(
	kind: GiftSectionKind,
	key: string,
	gifts: GiftByRole[],
	label: string | null = null,
	priorityKey: PriorityKey | null = null,
): GiftSection {
	return { kind, key, label, priorityKey, gifts };
}

function sinkReservedWithin(gifts: GiftByRole[]): GiftByRole[] {
	const available = gifts.filter((gift) => !isFullyReserved(gift));
	const reserved = gifts.filter((gift) => isFullyReserved(gift));
	return [...available, ...reserved];
}

interface GroupAccumulator {
	rank: number;
	key: string;
	label: string | null;
	priorityKey: PriorityKey | null;
	kind:
		| typeof GIFT_SECTION_KINDS.priorityGroup
		| typeof GIFT_SECTION_KINDS.noPriority
		| typeof GIFT_SECTION_KINDS.categoryGroup
		| typeof GIFT_SECTION_KINDS.uncategorized;
	gifts: GiftByRole[];
}

function buildPriorityGroups(gifts: GiftByRole[], sinkReserved: boolean): GiftSection[] {
	const groupsByLevel = new Map<string, GroupAccumulator>();
	const unprioritized: GiftByRole[] = [];

	for (const gift of gifts) {
		if (gift.priorityLevelId !== null && gift.prioritySortOrder !== null) {
			let group = groupsByLevel.get(gift.priorityLevelId);
			if (group === undefined) {
				group = {
					rank: gift.prioritySortOrder,
					key: `priority:${gift.priorityLevelId}`,
					label: gift.priorityLabel,
					priorityKey: getPriorityKey(gift.priorityLabel),
					kind: GIFT_SECTION_KINDS.priorityGroup,
					gifts: [],
				};
				groupsByLevel.set(gift.priorityLevelId, group);
			}
			group.gifts.push(gift);
		} else {
			unprioritized.push(gift);
		}
	}

	const orderedGroups: GroupAccumulator[] = [...groupsByLevel.values()].sort(
		(a, b) => a.rank - b.rank,
	);
	if (unprioritized.length > 0) {
		orderedGroups.push({
			rank: Number.MAX_SAFE_INTEGER,
			key: 'priority:none',
			label: null,
			priorityKey: null,
			kind: GIFT_SECTION_KINDS.noPriority,
			gifts: unprioritized,
		});
	}

	return orderedGroups.map((group) =>
		section(
			group.kind,
			group.key,
			sinkReserved ? sinkReservedWithin(group.gifts) : group.gifts,
			group.label,
			group.priorityKey,
		),
	);
}

function buildCategoryGroups(
	gifts: GiftByRole[],
	sinkReserved: boolean,
	locale: string,
): GiftSection[] {
	const language = locale.startsWith('en') ? 'en' : 'cs';
	const groupsByCategory = new Map<string, GroupAccumulator>();
	const uncategorized: GiftByRole[] = [];

	for (const gift of gifts) {
		if (
			gift.categoryId !== null &&
			gift.categoryId !== undefined &&
			gift.category !== null &&
			gift.category !== undefined
		) {
			let group = groupsByCategory.get(gift.categoryId);
			if (group === undefined) {
				group = {
					rank: gift.category.sortOrder,
					key: `category:${gift.categoryId}`,
					label: labelForGiftCategory(gift.category, language),
					priorityKey: null,
					kind: GIFT_SECTION_KINDS.categoryGroup,
					gifts: [],
				};
				groupsByCategory.set(gift.categoryId, group);
			}
			group.gifts.push(gift);
		} else {
			uncategorized.push(gift);
		}
	}

	const orderedGroups: GroupAccumulator[] = [...groupsByCategory.values()].sort(
		(a, b) => a.rank - b.rank,
	);
	if (uncategorized.length > 0) {
		orderedGroups.push({
			rank: Number.MAX_SAFE_INTEGER,
			key: 'category:none',
			label: null,
			priorityKey: null,
			kind: GIFT_SECTION_KINDS.uncategorized,
			gifts: uncategorized,
		});
	}

	return orderedGroups.map((group) =>
		section(
			group.kind,
			group.key,
			sinkReserved ? sinkReservedWithin(group.gifts) : group.gifts,
			group.label,
		),
	);
}

export function computeGiftSections(
	gifts: readonly GiftByRole[],
	role: WishlistRole,
	sortOption: GiftSortOption,
	grouping: GiftGroupingOption,
	locale: string,
): GiftSection[] {
	const pinOwnReservations = role === WISHLIST_ROLES.visitor || role === WISHLIST_ROLES.moderator;
	const sinkReserved = role === WISHLIST_ROLES.visitor;

	const activeGifts = gifts.filter((gift) => !gift.received);
	const receivedGifts = sortGifts(
		gifts.filter((gift) => gift.received),
		sortOption,
		locale,
	);
	const sorted = sortGifts(activeGifts, sortOption, locale);

	const own = pinOwnReservations ? sorted.filter(isOwnReservation) : [];
	const ownIds = new Set(own.map((gift) => gift.id));
	const rest = sorted.filter((gift) => !ownIds.has(gift.id));

	const sections: GiftSection[] = [];
	if (own.length > 0) {
		sections.push(section(GIFT_SECTION_KINDS.ownReservation, 'ownReservation', own));
	}

	if (grouping === GIFT_GROUPING_OPTIONS.priority) {
		sections.push(...buildPriorityGroups(rest, sinkReserved));
	} else if (grouping === GIFT_GROUPING_OPTIONS.category) {
		sections.push(...buildCategoryGroups(rest, sinkReserved, locale));
	} else {
		const availableKind =
			own.length > 0 ? GIFT_SECTION_KINDS.otherGifts : GIFT_SECTION_KINDS.available;

		if (sinkReserved) {
			const available = rest.filter((gift) => !isFullyReserved(gift));
			const reserved = rest.filter((gift) => isFullyReserved(gift));
			if (available.length > 0) {
				sections.push(section(availableKind, availableKind, available));
			}
			if (reserved.length > 0) {
				sections.push(section(GIFT_SECTION_KINDS.reserved, 'reserved', reserved));
			}
		} else if (rest.length > 0) {
			sections.push(section(availableKind, availableKind, rest));
		}
	}

	if (receivedGifts.length > 0) {
		sections.push(section(GIFT_SECTION_KINDS.received, 'received', receivedGifts));
	}

	return sections;
}
