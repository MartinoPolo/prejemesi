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
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

type GiftsContext = ReturnType<typeof createGiftsContext>;

const [useGifts, setGiftsInternal] = createContext<GiftsContext>();
/** @public */
export { useGifts };

export function setGiftsContext(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
) {
	const context = createGiftsContext(getGifts, getRole, getIsArchived, getIsAuthenticated);
	setGiftsInternal(context);
	return context;
}

function isGiftViewMode(value: unknown): value is GiftViewMode {
	return (
		typeof value === 'string' && Object.values(GIFT_VIEW_MODES).includes(value as GiftViewMode)
	);
}

function createGiftsContext(
	getGifts: () => GiftByRole[],
	getRole: () => WishlistRole,
	getIsArchived: () => boolean,
	getIsAuthenticated: () => boolean,
) {
	const gifts = new Derived(getGifts);
	const viewerRole = new Derived(getRole);
	const archived = new Derived(getIsArchived);
	const isAuthenticated = new Derived(getIsAuthenticated);

	const reorderOverride = new StateRaw<GiftByRole[] | null>(null);
	const effectiveGifts = new Derived<GiftByRole[]>(
		() => reorderOverride.current ?? gifts.current,
	);

	const viewMode = new Persisted<GiftViewMode>({
		key: 'prejemesi-gift-view-mode',
		serde: jsonSerde(isGiftViewMode),
		defaultValue: 'card',
	});

	const sortOption = new StateRaw<GiftSortOption>(GIFT_SORT_OPTIONS.ownerOrder);
	const filters = new StateRaw<GiftFilters>({
		availableOnly: false,
		withLinkOnly: false,
	});

	const hasActiveFilters = new Derived(
		() => filters.current.availableOnly || filters.current.withLinkOnly,
	);

	const sortedAndFilteredGifts = new Derived<GiftByRole[]>(() => {
		let result = [...effectiveGifts.current];

		const currentFilters = filters.current;
		if (currentFilters.availableOnly && viewerRole.current !== 'owner') {
			result = result.filter((giftItem) => {
				const visitorGift = giftItem as GiftForVisitor;
				return !visitorGift.isFullyReserved;
			});
		}
		if (currentFilters.withLinkOnly) {
			result = result.filter((giftItem) => giftItem.links.length > 0);
		}

		const currentSort = sortOption.current;
		result.sort((a, b) => {
			switch (currentSort) {
				case GIFT_SORT_OPTIONS.ownerOrder:
					return a.sortOrder - b.sortOrder;
				case GIFT_SORT_OPTIONS.priority: {
					const aPriority = a.prioritySortOrder ?? 999;
					const bPriority = b.prioritySortOrder ?? 999;
					return aPriority - bPriority;
				}
				case GIFT_SORT_OPTIONS.priceAsc: {
					const aPrice = a.price ?? Number.MAX_SAFE_INTEGER;
					const bPrice = b.price ?? Number.MAX_SAFE_INTEGER;
					return aPrice - bPrice;
				}
				case GIFT_SORT_OPTIONS.priceDesc: {
					const aPrice = a.price ?? -1;
					const bPrice = b.price ?? -1;
					return bPrice - aPrice;
				}
				case GIFT_SORT_OPTIONS.name:
					return a.name.localeCompare(b.name, 'cs');
				case GIFT_SORT_OPTIONS.dateAdded:
					return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
				default:
					return 0;
			}
		});

		return result;
	});

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
		sortOption,
		filters,
		hasActiveFilters,
		sortedAndFilteredGifts,
		giftCount,
		filteredCount,
		reorderGifts,
		clearReorderOverride,
	};
}
