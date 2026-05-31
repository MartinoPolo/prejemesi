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
export { useGifts };

export function setGiftsContext(
	initialGifts: GiftByRole[],
	role: WishlistRole,
	isArchived: boolean,
) {
	const context = createGiftsContext(initialGifts, role, isArchived);
	setGiftsInternal(context);
	return context;
}

function isGiftViewMode(value: unknown): value is GiftViewMode {
	return (
		typeof value === 'string' && Object.values(GIFT_VIEW_MODES).includes(value as GiftViewMode)
	);
}

function createGiftsContext(initialGifts: GiftByRole[], role: WishlistRole, isArchived: boolean) {
	const gifts = new StateRaw<GiftByRole[]>(initialGifts);
	const viewerRole = new StateRaw<WishlistRole>(role);
	const archived = new StateRaw(isArchived);

	const viewMode = new Persisted<GiftViewMode>({
		key: 'darecky-gift-view-mode',
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
		let result = [...gifts.current];

		// Apply filters (only for visitor/moderator with reservation data)
		const currentFilters = filters.current;
		if (currentFilters.availableOnly && viewerRole.current !== 'owner') {
			result = result.filter((giftItem) => {
				const visitorGift = giftItem as GiftForVisitor;
				return !visitorGift.isFullyReserved;
			});
		}
		if (currentFilters.withLinkOnly) {
			result = result.filter((giftItem) => giftItem.url !== null && giftItem.url !== '');
		}

		// Apply sort
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

	const giftCount = new Derived(() => gifts.current.length);
	const filteredCount = new Derived(() => sortedAndFilteredGifts.current.length);

	/** Replace the full gifts list (e.g. after server refetch) */
	function replaceGifts(newGifts: GiftByRole[]) {
		gifts.current = newGifts;
	}

	/** Add a single gift to the list */
	function addGift(newGift: GiftByRole) {
		gifts.current = [...gifts.current, newGift];
	}

	/** Update a single gift in the list */
	function updateGift(updatedGift: GiftByRole) {
		gifts.current = gifts.current.map((g) => (g.id === updatedGift.id ? updatedGift : g));
	}

	/** Remove a gift from the list */
	function removeGift(giftId: string) {
		gifts.current = gifts.current.filter((g) => g.id !== giftId);
	}

	/** Reorder gifts by updating sortOrder values */
	function reorderGifts(reorderedGifts: GiftByRole[]) {
		gifts.current = reorderedGifts.map((g, index) => ({
			...g,
			sortOrder: index,
		}));
	}

	return {
		gifts,
		viewerRole,
		archived,
		viewMode,
		sortOption,
		filters,
		hasActiveFilters,
		sortedAndFilteredGifts,
		giftCount,
		filteredCount,
		replaceGifts,
		addGift,
		updateGift,
		removeGift,
		reorderGifts,
	};
}
