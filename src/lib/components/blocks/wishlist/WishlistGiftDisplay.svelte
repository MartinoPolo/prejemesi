<script lang="ts">
	import WishlistEmptyState from './WishlistEmptyState.svelte';
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
		isEmpty: boolean;
		isFilteredEmpty: boolean;
		draggedIndex: number | null;
		dragOverIndex: number | null;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
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
		isEmpty,
		isFilteredEmpty,
		draggedIndex,
		dragOverIndex,
		onedit,
		onreserve,
		onaddgift,
		onclearfilters,
		ondragstart,
		ondragover,
		ondragleave,
		ondrop,
		ondragend,
	}: WishlistGiftDisplayProps = $props();
</script>

{#if isEmpty || isFilteredEmpty}
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
	/>
{/if}
