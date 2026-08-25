import type { GiftByRole, GiftSortOption } from './types.js';
import { GIFT_SORT_OPTIONS } from './types.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

/**
 * Role-aware reserved-gift ordering (issue #224). Rune-free so it can be unit-tested and reused
 * by the gifts context. Given the already-filtered gifts for one viewer, it applies the chosen
 * sort and partitions the result into ordered display sections (bands and — optionally — priority
 * groups). Flattening the sections' gifts reproduces the exact render order.
 */

export const GIFT_SECTION_KINDS = {
	/** Viewer's own reservations, pinned to the top under the „Vaše rezervace" header. */
	ownReservation: 'ownReservation',
	/** Neutral band (grouping off): available gifts, or the recipient's whole list. No header. */
	available: 'available',
	/**
	 * Available gifts that follow an own-reservation band (grouping off): same gifts as
	 * {@link GIFT_SECTION_KINDS.available}, but carrying the „Ostatní dárky" header so the row
	 * breaks and the viewer's own reservations sit alone above it (issue #224 follow-up).
	 */
	otherGifts: 'otherGifts',
	/** Fully-reserved-not-mine gifts sunk to the bottom (grouping off, visitor only). No header. */
	reserved: 'reserved',
	/** One priority level's gifts (grouping on); header is the level label. */
	priorityGroup: 'priorityGroup',
	/** Unprioritized gifts (grouping on) under the „Bez priority" header. */
	noPriority: 'noPriority',
	/** Received gifts, structurally isolated in the final archive-like section. */
	received: 'received',
} as const;

export type GiftSectionKind = (typeof GIFT_SECTION_KINDS)[keyof typeof GIFT_SECTION_KINDS];

export interface GiftSection {
	kind: GiftSectionKind;
	/** Priority-level name for {@link GIFT_SECTION_KINDS.priorityGroup}; null otherwise (the header
	 *  copy for the other kinds is a fixed message the renderer supplies). */
	label: string | null;
	gifts: GiftByRole[];
}

/**
 * Whether a section carries a visible header. The neutral available band and the sunk reserved
 * band render headerless (issue #224 REQ-1): the dimmed overlay already communicates "reserved".
 */
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

/**
 * Sort rank for gifts without a priority level: just above the numerically-lowest priority level
 * present (the last level in level order), so „no priority set" reads as neutral, not least-wanted
 * (issue #224 REQ-5). Returns 0 when no gift carries a priority.
 */
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
	return maxSortOrder === null ? 0 : maxSortOrder - 0.5;
}

/**
 * Applies a toolbar sort option to a copy of the gifts. The `priority` option ranks unprioritized
 * gifts via {@link computeUnprioritizedRank} instead of sinking them last (issue #224 REQ-5).
 */
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

/** Available-first, reserved-last within a band (issue #224 REQ-1); order-preserving otherwise. */
function sinkReservedWithin(gifts: GiftByRole[]): GiftByRole[] {
	const available = gifts.filter((gift) => !isFullyReserved(gift));
	const reserved = gifts.filter((gift) => isFullyReserved(gift));
	return [...available, ...reserved];
}

interface PriorityGroupAccumulator {
	rank: number;
	label: string | null;
	kind: typeof GIFT_SECTION_KINDS.priorityGroup | typeof GIFT_SECTION_KINDS.noPriority;
	gifts: GiftByRole[];
}

function buildPriorityGroups(gifts: GiftByRole[], sinkReserved: boolean): GiftSection[] {
	const groupsByLevel = new Map<string, PriorityGroupAccumulator>();
	const unprioritized: GiftByRole[] = [];

	for (const gift of gifts) {
		if (gift.priorityLevelId !== null && gift.prioritySortOrder !== null) {
			let group = groupsByLevel.get(gift.priorityLevelId);
			if (group === undefined) {
				group = {
					rank: gift.prioritySortOrder,
					label: gift.priorityLabel,
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

	const orderedGroups: PriorityGroupAccumulator[] = [...groupsByLevel.values()];
	if (unprioritized.length > 0) {
		orderedGroups.push({
			rank: computeUnprioritizedRank(gifts),
			label: null,
			kind: GIFT_SECTION_KINDS.noPriority,
			gifts: unprioritized,
		});
	}
	orderedGroups.sort((a, b) => a.rank - b.rank);

	return orderedGroups.map((group) => ({
		kind: group.kind,
		label: group.label,
		gifts: sinkReserved ? sinkReservedWithin(group.gifts) : group.gifts,
	}));
}

/**
 * Partitions the viewer's filtered gifts into ordered display sections (issue #224).
 *
 * Per role: a visitor gets the own-reservation pin, sinking of foreign fully-reserved gifts, and
 * (with `groupByPriority`) priority groups; a moderator gets the pin and groups but NO sinking (the
 * curated owner order stands); a recipient gets neither — no reservation data reaches them, so the
 * result is one neutral band (or priority groups when grouping is on).
 */
export function computeGiftSections(
	gifts: readonly GiftByRole[],
	role: WishlistRole,
	sortOption: GiftSortOption,
	groupByPriority: boolean,
	locale: string,
): GiftSection[] {
	const pinOwnReservations = role === WISHLIST_ROLES.visitor || role === WISHLIST_ROLES.moderator;
	const sinkReserved = role === WISHLIST_ROLES.visitor;

	// Partition before any reservation bands or priority grouping. Received gifts can therefore
	// never be interleaved with active browsing sections, regardless of role or presentation.
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
		sections.push({ kind: GIFT_SECTION_KINDS.ownReservation, label: null, gifts: own });
	}

	if (groupByPriority) {
		sections.push(...buildPriorityGroups(rest, sinkReserved));
		if (receivedGifts.length > 0) {
			sections.push({ kind: GIFT_SECTION_KINDS.received, label: null, gifts: receivedGifts });
		}
		return sections;
	}

	// With an own-reservation band above it, the available band gets the „Ostatní dárky" header so
	// its row breaks and the pinned own reservations stand alone (issue #224 follow-up); without one
	// it stays a neutral headerless band.
	const availableKind =
		own.length > 0 ? GIFT_SECTION_KINDS.otherGifts : GIFT_SECTION_KINDS.available;

	if (sinkReserved) {
		const available = rest.filter((gift) => !isFullyReserved(gift));
		const reserved = rest.filter((gift) => isFullyReserved(gift));
		if (available.length > 0) {
			sections.push({ kind: availableKind, label: null, gifts: available });
		}
		if (reserved.length > 0) {
			sections.push({ kind: GIFT_SECTION_KINDS.reserved, label: null, gifts: reserved });
		}
	} else if (rest.length > 0) {
		sections.push({ kind: availableKind, label: null, gifts: rest });
	}

	if (receivedGifts.length > 0) {
		sections.push({ kind: GIFT_SECTION_KINDS.received, label: null, gifts: receivedGifts });
	}

	return sections;
}
