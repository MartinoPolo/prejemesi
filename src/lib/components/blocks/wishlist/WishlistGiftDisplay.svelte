<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import WishlistEmptyState from './WishlistEmptyState.svelte';
	import GiftCardSkeleton from '$lib/components/blocks/gift/GiftCardSkeleton.svelte';
	import WishlistGiftCardGrid from './WishlistGiftCardGrid.svelte';
	import WishlistGiftListView from './WishlistGiftListView.svelte';
	import WishlistGiftCompactTable from './WishlistGiftCompactTable.svelte';
	import type { GiftByRole, GiftForVisitor, GiftViewMode } from '$lib/modules/gifts/types.js';
	import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';

	interface WishlistGiftDisplayProps {
		/** Shared display sections consumed identically by every view mode. */
		sections: GiftSection[];
		role: WishlistRole;
		isArchived: boolean;
		viewMode: GiftViewMode;
		isLoading?: boolean;
		isEmpty: boolean;
		isFilteredEmpty: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onaddgift: () => void;
		onclearfilters: () => void;
		onreorder: (fromIndex: number, toIndex: number) => void;
	}

	let {
		sections,
		role,
		isArchived,
		viewMode,
		isLoading = false,
		isEmpty,
		isFilteredEmpty,
		onedit,
		onreserve,
		onunreserve,
		onaddgift,
		onclearfilters,
		onreorder,
	}: WishlistGiftDisplayProps = $props();

	// Management affordances (add/edit/reorder) open to recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	// The recipient (person the list is for) never sees the like/reserve columns — their own surprise.
	const isRecipient = $derived(role === WISHLIST_ROLES.recipient);
</script>

{#if isLoading}
	<div
		class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
		aria-busy="true"
		aria-label={m.wishlist_detail_loading_gifts()}
	>
		{#each Array.from({ length: 6 }, (_, i) => i) as index (index)}
			<GiftCardSkeleton />
		{/each}
	</div>
{:else if isEmpty || isFilteredEmpty}
	<WishlistEmptyState {isArchived} {canManage} {isFilteredEmpty} {onaddgift} {onclearfilters} />
{:else if viewMode === 'card'}
	<WishlistGiftCardGrid
		{sections}
		{role}
		{isArchived}
		{canManage}
		{onedit}
		{onreserve}
		{onunreserve}
		{onreorder}
	/>
{:else if viewMode === 'list'}
	<WishlistGiftListView
		{sections}
		{role}
		{isArchived}
		{canManage}
		{onedit}
		{onreserve}
		{onunreserve}
		{onreorder}
	/>
{:else}
	<WishlistGiftCompactTable
		{sections}
		{role}
		{isArchived}
		{isRecipient}
		{canManage}
		{onedit}
		{onreserve}
		{onunreserve}
	/>
{/if}
