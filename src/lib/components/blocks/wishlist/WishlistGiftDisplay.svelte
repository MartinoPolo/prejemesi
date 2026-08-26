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
		hideReservationState: boolean;
		viewMode: GiftViewMode;
		isLoading?: boolean;
		isEmpty: boolean;
		isFilteredEmpty: boolean;
		reorderMode: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreceived: (giftId: string, received: boolean) => void;
		onaddgift: () => void;
		onclearfilters: () => void;
		onreorderpreview: (orderedIds: string[]) => void;
		onreordercommit: (orderedIds: string[]) => void;
		onreordercancel: (orderedIds: string[]) => void;
	}

	let {
		sections,
		role,
		isArchived,
		hideReservationState,
		viewMode,
		isLoading = false,
		isEmpty,
		isFilteredEmpty,
		reorderMode,
		onedit,
		onreserve,
		onunreserve,
		onreceived,
		onaddgift,
		onclearfilters,
		onreorderpreview,
		onreordercommit,
		onreordercancel,
	}: WishlistGiftDisplayProps = $props();

	// Management affordances (add/edit/reorder) open to recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	// The recipient and recipient-view preview share one presentation gate. Actual role remains
	// separate so manager edit/reorder affordances stay authorized normally.
	const reservationStateHidden = $derived(
		hideReservationState || role === WISHLIST_ROLES.recipient,
	);
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
		hideReservationState={reservationStateHidden}
		reorderEnabled={reorderMode && canManage && !isArchived}
		{onedit}
		{onreserve}
		{onunreserve}
		{onreceived}
		{onreorderpreview}
		{onreordercommit}
		{onreordercancel}
	/>
{:else if viewMode === 'list'}
	<WishlistGiftListView
		{sections}
		{role}
		{isArchived}
		hideReservationState={reservationStateHidden}
		reorderEnabled={reorderMode && canManage && !isArchived}
		{onedit}
		{onreserve}
		{onunreserve}
		{onreceived}
		{onreorderpreview}
		{onreordercommit}
		{onreordercancel}
	/>
{:else}
	<WishlistGiftCompactTable
		{sections}
		{role}
		{isArchived}
		hideReservationState={reservationStateHidden}
		{canManage}
		{onedit}
		{onreserve}
		{onunreserve}
		{onreceived}
	/>
{/if}
