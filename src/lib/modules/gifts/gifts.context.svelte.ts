import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { Persisted, jsonSerde } from '$lib/reactivity/persisted.svelte.js';
import {
	GIFT_VIEW_MODES,
	GIFT_SORT_OPTIONS,
	type GiftViewMode,
	type GiftSortOption,
	type GiftFilters,
	type GiftForVisitor,
	type GiftByRole,
} from './types.js';
import { computeGiftSections } from './gift_ordering.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import { getLocale } from '$lib/paraglide/runtime.js';

type GiftsContext = ReturnType<typeof createGiftsContext>;

const [useGifts, setGiftsInternal] = createContext<GiftsContext>();
/** @public */
export { useGifts };

export function setGiftsContext(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
	getLikedIds: () => string[],
) {
	const context = createGiftsContext(
		getGifts,
		getRole,
		getIsArchived,
		getIsAuthenticated,
		getLikedIds,
	);
	setGiftsInternal(context);
	return context;
}

function isGiftViewMode(value: unknown): value is GiftViewMode {
	return (
		typeof value === 'string' && Object.values(GIFT_VIEW_MODES).includes(value as GiftViewMode)
	);
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

function createGiftsContext(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
	getLikedIds: () => string[],
) {
	const gifts = new Derived(getGifts);
	const viewerRole = new Derived(getRole);
	const archived = new Derived(getIsArchived);
	const isAuthenticated = new Derived(getIsAuthenticated);
	// Set for O(1) lookup in the likedOnly filter (mirrors LikesContext.baseLikedIds).
	const likedIdSet = new Derived(() => new Set(getLikedIds()));

	const reorderOverride = new StateRaw<GiftByRole[] | null>(null);
	const effectiveGifts = new Derived<GiftByRole[]>(
		() => reorderOverride.current ?? gifts.current,
	);

	const viewMode = new Persisted<GiftViewMode>({
		key: 'prejemesi-gift-view-mode',
		serde: jsonSerde(isGiftViewMode),
		defaultValue: 'card',
	});

	// Per-device presentation preference (issue #224 REQ-4), persisted like viewMode — unlike
	// sort/filters, which stay per-visit.
	const priorityGrouping = new Persisted<boolean>({
		key: 'prejemesi-gift-priority-grouping',
		serde: jsonSerde(isBoolean),
		defaultValue: false,
	});

	const sortOption = new StateRaw<GiftSortOption>(GIFT_SORT_OPTIONS.ownerOrder);
	const filters = new StateRaw<GiftFilters>({
		availableOnly: false,
		withLinkOnly: false,
		likedOnly: false,
		showReceived: false,
	});

	const hasActiveFilters = new Derived(
		() =>
			filters.current.availableOnly ||
			filters.current.withLinkOnly ||
			filters.current.likedOnly ||
			filters.current.showReceived,
	);

	// Filter only — sorting and banding move to computeGiftSections (issue #224) so the section
	// order and the flat sortedAndFilteredGifts stay in lockstep.
	const filteredGifts = new Derived<GiftByRole[]>(() => {
		let result = [...effectiveGifts.current];

		const currentFilters = filters.current;
		if (!currentFilters.showReceived) {
			result = result.filter((giftItem) => !giftItem.received);
		}
		if (currentFilters.availableOnly && viewerRole.current !== 'recipient') {
			result = result.filter((giftItem) => {
				const visitorGift = giftItem as GiftForVisitor;
				return !visitorGift.isFullyReserved;
			});
		}
		if (currentFilters.withLinkOnly) {
			result = result.filter((giftItem) => giftItem.links.length > 0);
		}
		if (currentFilters.likedOnly) {
			result = result.filter((giftItem) => likedIdSet.current.has(giftItem.id));
		}

		return result;
	});

	const giftSections = new Derived(() =>
		computeGiftSections(
			filteredGifts.current,
			viewerRole.current,
			sortOption.current,
			priorityGrouping.current,
			getLocale(),
		),
	);

	// Flattened section order — the single source consumed by filteredCount/isFilteredEmpty and
	// every existing flat-list consumer (compact view, reorder mapping).
	const sortedAndFilteredGifts = new Derived<GiftByRole[]>(() =>
		giftSections.current.flatMap((section) => section.gifts),
	);

	// The priority-grouping toggle is offered only when at least one gift carries a priority
	// (issue #224 REQ-4) — measured over all gifts, not the filtered subset.
	const hasAnyPriority = new Derived(() =>
		effectiveGifts.current.some((giftItem) => giftItem.priorityLevelId !== null),
	);

	const giftCount = new Derived(() => effectiveGifts.current.length);
	const filteredCount = new Derived(() => sortedAndFilteredGifts.current.length);

	function reorderGifts(reorderedGifts: GiftByRole[]) {
		reorderOverride.current = reorderedGifts.map((g, index) => ({
			...g,
			sortOrder: index,
		}));
	}

	function clearReorderOverride() {
		reorderOverride.current = null;
	}

	return {
		gifts,
		effectiveGifts,
		viewerRole,
		archived,
		isAuthenticated,
		viewMode,
		priorityGrouping,
		sortOption,
		filters,
		hasActiveFilters,
		hasAnyPriority,
		giftSections,
		sortedAndFilteredGifts,
		giftCount,
		filteredCount,
		reorderGifts,
		clearReorderOverride,
	};
}
