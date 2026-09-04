<script lang="ts">
	import { setContext, tick, untrack, type Snippet } from 'svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
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
		selectionMode?: boolean;
		selectedIds?: readonly string[];
		onselectiontoggle?: (giftId: string) => void;
		oncontextactions?: (gift: GiftByRole, event: MouseEvent | null) => boolean;
		hascontextactions?: (gift: GiftByRole) => boolean;
		contextContent?: Snippet;
		contextMenuOpen?: boolean;
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
		selectionMode = false,
		selectedIds = [],
		onselectiontoggle,
		oncontextactions,
		hascontextactions,
		contextContent,
		contextMenuOpen = $bindable(false),
	}: WishlistGiftDisplayProps = $props();

	// Management affordances (add/edit/reorder) open to recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	// The recipient and recipient-view preview share one presentation gate. Actual role remains
	// separate so manager edit/reorder affordances stay authorized normally.
	const reservationStateHidden = $derived(
		hideReservationState || role === WISHLIST_ROLES.recipient,
	);

	const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
	let displayedViewMode = $state(untrack(() => viewMode));
	let collectionElement = $state<HTMLElement | null>(null);
	let activeAnimation: Animation | null = null;
	let transitionRun = 0;
	const selectedIdSet = $derived(new Set(selectedIds));
	setContext<(giftId: string) => boolean>('wishlist-gift-selection', (giftId) =>
		selectedIdSet.has(giftId),
	);

	function cancelActiveTransition() {
		transitionRun += 1;
		activeAnimation?.cancel();
		activeAnimation = null;
	}

	function reducedMotionRequested() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	async function transitionTo(nextViewMode: GiftViewMode) {
		cancelActiveTransition();
		const run = transitionRun;

		if (
			collectionElement === null ||
			reducedMotionRequested() ||
			displayedViewMode === 'compact' ||
			nextViewMode === 'compact'
		) {
			displayedViewMode = nextViewMode;
			return;
		}

		const exit = collectionElement.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 160,
			easing: STANDARD_EASING,
			fill: 'both',
		});
		activeAnimation = exit;
		await exit.finished.catch(() => undefined);
		if (run !== transitionRun) {
			return;
		}

		activeAnimation = null;
		displayedViewMode = nextViewMode;
		await tick();
		if (run !== transitionRun || collectionElement === null) {
			return;
		}

		exit.cancel();
		const enter = collectionElement.animate(
			[
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'none' },
			],
			{ duration: 280, easing: STANDARD_EASING, fill: 'both' },
		);
		activeAnimation = enter;
		await enter.finished.catch(() => undefined);
		if (run === transitionRun) {
			enter.cancel();
			activeAnimation = null;
		}
	}

	$effect(() => {
		if (viewMode !== displayedViewMode) {
			void transitionTo(viewMode);
		} else if (activeAnimation !== null) {
			cancelActiveTransition();
		}
	});

	$effect(() => {
		if (selectionMode && contextMenuOpen) {
			contextMenuOpen = false;
		}
	});

	$effect(() => () => cancelActiveTransition());
</script>

<ContextMenu.Root bind:open={contextMenuOpen}>
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
		<WishlistEmptyState
			{isArchived}
			{canManage}
			{isFilteredEmpty}
			{onaddgift}
			{onclearfilters}
		/>
	{:else}
		<ContextMenu.Trigger disabled={displayedViewMode === 'compact' || selectionMode}>
			{#snippet child({ props: triggerProps })}
				<div
					{...triggerProps}
					style={undefined}
					bind:this={collectionElement}
					data-wishlist-gift-collection
					data-view-mode={displayedViewMode}
					class="relative z-(--z-base)"
					role={selectionMode ? 'group' : undefined}
					aria-label={selectionMode ? m.gift_selection_listbox_label() : undefined}
				>
					{#if displayedViewMode === 'card'}
						<WishlistGiftCardGrid
							{hascontextactions}
							{sections}
							{role}
							{isArchived}
							hideReservationState={reservationStateHidden}
							reorderEnabled={reorderMode &&
								canManage &&
								!isArchived &&
								!selectionMode}
							{selectionMode}
							{onselectiontoggle}
							{oncontextactions}
							{onedit}
							{onreserve}
							{onunreserve}
							{onreceived}
							{onreorderpreview}
							{onreordercommit}
							{onreordercancel}
						/>
					{:else if displayedViewMode === 'list'}
						<WishlistGiftListView
							{hascontextactions}
							{sections}
							{role}
							{isArchived}
							hideReservationState={reservationStateHidden}
							reorderEnabled={reorderMode &&
								canManage &&
								!isArchived &&
								!selectionMode}
							{selectionMode}
							{onselectiontoggle}
							{oncontextactions}
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
				</div>
			{/snippet}
		</ContextMenu.Trigger>
	{/if}
	{#if contextContent}{@render contextContent()}{/if}
</ContextMenu.Root>
