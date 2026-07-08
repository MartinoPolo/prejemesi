<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import WishlistEmptyState from './WishlistEmptyState.svelte';
	import GiftCardSkeleton from '$lib/components/blocks/gift/GiftCardSkeleton.svelte';
	import WishlistGiftCardGrid from './WishlistGiftCardGrid.svelte';
	import WishlistGiftListView from './WishlistGiftListView.svelte';
	import WishlistGiftCompactTable from './WishlistGiftCompactTable.svelte';
	import type { GiftByRole, GiftForVisitor, GiftViewMode } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftDisplayProps {
		gifts: GiftByRole[];
		role: WishlistRole;
		isArchived: boolean;
		isOwner: boolean;
		isOwnerOrModerator: boolean;
		viewMode: GiftViewMode;
		isLoading?: boolean;
		isEmpty: boolean;
		isFilteredEmpty: boolean;
		draggedIndex: number | null;
		dragOverIndex: number | null;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onaddgift: () => void;
		onclearfilters: () => void;
		ondragstart: (event: DragEvent, index: number) => void;
		ondragover: (event: DragEvent, index: number) => void;
		ondragleave: () => void;
		ondrop: (event: DragEvent, index: number) => void;
		ondragend: () => void;
	}

	let {
		gifts,
		role,
		isArchived,
		isOwner,
		isOwnerOrModerator,
		viewMode,
		isLoading = false,
		isEmpty,
		isFilteredEmpty,
		draggedIndex,
		dragOverIndex,
		onedit,
		onreserve,
		onunreserve,
		onaddgift,
		onclearfilters,
		ondragstart,
		ondragover,
		ondragleave,
		ondrop,
		ondragend,
	}: WishlistGiftDisplayProps = $props();
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
	<WishlistEmptyState {isArchived} {isOwner} {isFilteredEmpty} {onaddgift} {onclearfilters} />
{:else if viewMode === 'card'}
	<WishlistGiftCardGrid
		{gifts}
		{role}
		{isArchived}
		{isOwnerOrModerator}
		{draggedIndex}
		{dragOverIndex}
		{onedit}
		{onreserve}
		{onunreserve}
		{ondragstart}
		{ondragover}
		{ondragleave}
		{ondrop}
		{ondragend}
	/>
{:else if viewMode === 'list'}
	<WishlistGiftListView
		{gifts}
		{role}
		{isArchived}
		{isOwnerOrModerator}
		{draggedIndex}
		{dragOverIndex}
		{onedit}
		{onreserve}
		{onunreserve}
		{ondragstart}
		{ondragover}
		{ondragleave}
		{ondrop}
		{ondragend}
	/>
{:else}
	<WishlistGiftCompactTable
		{gifts}
		{role}
		{isArchived}
		{isOwner}
		{isOwnerOrModerator}
		{onedit}
		{onreserve}
		{onunreserve}
	/>
{/if}
