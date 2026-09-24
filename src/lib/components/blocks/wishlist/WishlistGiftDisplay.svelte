<script lang="ts">
	import { setContext, tick, untrack, type Snippet } from 'svelte';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import WishlistEmptyState from './WishlistEmptyState.svelte';
	import GiftCardSkeleton from '$lib/components/blocks/gift/GiftCardSkeleton.svelte';
	import WishlistGiftCardGrid from './WishlistGiftCardGrid.svelte';
	import WishlistGiftListView from './WishlistGiftListView.svelte';
	import WishlistGiftCompactTable from './WishlistGiftCompactTable.svelte';
	import type {
		GiftByRole,
		GiftForVisitor,
		GiftGroupingOption,
		GiftViewMode,
	} from '$lib/modules/gifts/types.js';
	import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import type { GiftContextInvocation } from './gift_context_invocation.js';
	import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import {
		giftCardCollectionLayout,
		measureGiftCardCollectionLayout,
	} from './gift_card_collection_layout.js';
	import { createGiftCollectionMotion } from '$lib/motion/gift_collection_motion.js';

	interface WishlistGiftDisplayProps {
		/** Shared display sections consumed identically by every view mode. */
		sections: GiftSection[];
		motionKey?: string;
		role: WishlistRole;
		isArchived: boolean;
		hideReservationState: boolean;
		viewMode: GiftViewMode;
		isLoading?: boolean;
		isEmpty: boolean;
		isFilteredEmpty: boolean;
		reorderMode: boolean;
		reorderInteractionEnabled?: boolean;
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
		oncontextactions?: (gift: GiftByRole, invocation: GiftContextInvocation) => boolean;
		hascontextactions?: (gift: GiftByRole) => boolean;
		contextContent?: Snippet;
		nativeContextOpen?: boolean;
		nativeContextSessionId?: number;
		onnativecontextcomplete?: (sessionId: number) => void;
		activeContextGiftId?: string | null;
		contextSurface?: 'menu' | 'dialog';
		grouping?: GiftGroupingOption;
		receivedPendingGiftIds?: ReadonlySet<string>;
	}

	let {
		sections,
		motionKey,
		role,
		isArchived,
		hideReservationState,
		viewMode,
		isLoading = false,
		isEmpty,
		isFilteredEmpty,
		reorderMode,
		reorderInteractionEnabled = true,
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
		nativeContextOpen = $bindable(false),
		nativeContextSessionId = 0,
		onnativecontextcomplete,
		activeContextGiftId = null,
		contextSurface = 'menu',
		grouping = 'none',
		receivedPendingGiftIds = new Set<string>(),
	}: WishlistGiftDisplayProps = $props();

	// Management affordances (add/edit/reorder) open to recipient OR správce.
	const canManage = $derived(canManageWishlist(role));
	// The recipient and recipient-view preview share one presentation gate. Actual role remains
	// separate so manager edit/reorder affordances stay authorized normally.
	const reservationStateHidden = $derived(
		hideReservationState || role === WISHLIST_ROLES.recipient,
	);
	const showPriority = $derived(grouping !== 'priority');
	const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
	let displayedViewMode = $state(untrack(() => viewMode));
	const ImageGiftView = $derived(
		displayedViewMode === 'card' ? WishlistGiftCardGrid : WishlistGiftListView,
	);
	let collectionElement = $state<HTMLElement | null>(null);
	let motionHost = $state<HTMLElement | null>(null);
	let motion: ReturnType<typeof createGiftCollectionMotion> | null = null;
	let motionSuspended = true;
	let previousMotionKey = untrack(() => motionKey);
	let activeAnimation: Animation | null = null;
	let openedNativeSessionId = $state(0);
	let transitionRun = 0;
	let viewTransitioning = false;
	const collectionIsOutgoing = $derived(viewMode !== displayedViewMode);
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
		motion?.reset(true);
		motionSuspended = true;
		viewTransitioning = true;
		cancelActiveTransition();
		const run = transitionRun;

		if (
			collectionElement === null ||
			reducedMotionRequested() ||
			displayedViewMode === 'compact' ||
			nextViewMode === 'compact'
		) {
			displayedViewMode = nextViewMode;
			await tick();
			motion?.reset(isLoading);
			motionSuspended = isLoading;
			viewTransitioning = false;
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
			motion?.reset(isLoading);
			motionSuspended = isLoading;
			viewTransitioning = false;
		}
	}

	$effect(() => {
		if (viewMode !== displayedViewMode) {
			void transitionTo(viewMode);
		} else if (viewTransitioning && activeAnimation !== null) {
			cancelActiveTransition();
			viewTransitioning = false;
			motion?.reset(isLoading);
			motionSuspended = isLoading;
		}
	});

	$effect(() => {
		if (selectionMode && nativeContextOpen === true) {
			nativeContextOpen = false;
		}
	});

	// Explicitly depend on both section identity and gift content before Svelte patches the DOM.
	function readMotionInputs() {
		for (const section of sections) {
			void section.key;
			for (const gift of section.gifts) {
				void Object.values(gift);
			}
		}
		void [
			role,
			isArchived,
			hideReservationState,
			grouping,
			showPriority,
			reorderMode,
			selectionMode,
			receivedPendingGiftIds,
			isEmpty,
			isFilteredEmpty,
			isLoading,
			viewMode,
			motionKey,
		];
	}

	$effect.pre(() => {
		readMotionInputs();
		if (motionKey !== previousMotionKey) {
			previousMotionKey = motionKey;
			motion?.reset(true);
			motionSuspended = true;
		} else if (viewTransitioning || viewMode !== displayedViewMode || isLoading) {
			motion?.reset(true);
			motionSuspended = true;
		} else if (!motionSuspended) {
			motion?.beforeUpdate();
		}
	});

	$effect(() => {
		readMotionInputs();
		const host = motionHost;
		if (!host) {
			return;
		}
		if (!motion) {
			motion = createGiftCollectionMotion(host);
		}
		if (
			isLoading ||
			viewTransitioning ||
			viewMode !== displayedViewMode ||
			collectionIsOutgoing
		) {
			motion.reset(true);
			motionSuspended = true;
			return;
		}
		let active = true;
		void tick().then(() => {
			if (
				!active ||
				!motion ||
				viewTransitioning ||
				viewMode !== displayedViewMode ||
				isLoading
			) {
				return;
			}
			if (collectionElement) {
				measureGiftCardCollectionLayout(collectionElement);
			}
			if (motionSuspended) {
				if (activeAnimation !== null) {
					return;
				}
				motion.reset(false);
				motionSuspended = false;
			} else {
				motion.afterUpdate();
			}
		});
		return () => {
			active = false;
		};
	});

	$effect(() => () => {
		cancelActiveTransition();
		motion?.destroy();
		motion = null;
	});
</script>

{#snippet giftCollection()}
	<ContextMenu.Trigger
		disabled={displayedViewMode === 'compact' || selectionMode || collectionIsOutgoing}
	>
		{#snippet child({ props: triggerProps })}
			<div
				{...triggerProps}
				style={undefined}
				bind:this={collectionElement}
				use:giftCardCollectionLayout
				data-wishlist-gift-collection
				data-view-mode={displayedViewMode}
				inert={collectionIsOutgoing}
				aria-hidden={collectionIsOutgoing ? true : undefined}
				class="relative z-(--z-base)"
				role={selectionMode ? 'group' : undefined}
				aria-label={selectionMode ? m.gift_selection_listbox_label() : undefined}
			>
				{#if displayedViewMode !== 'compact'}
					<ImageGiftView
						{hascontextactions}
						{activeContextGiftId}
						{contextSurface}
						{sections}
						{role}
						{showPriority}
						{isArchived}
						hideReservationState={reservationStateHidden}
						reorderEnabled={reorderMode &&
							reorderInteractionEnabled &&
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
						{receivedPendingGiftIds}
						{onreorderpreview}
						{onreordercommit}
						{onreordercancel}
					/>
				{:else}
					<WishlistGiftCompactTable
						{sections}
						{role}
						{showPriority}
						{isArchived}
						hideReservationState={reservationStateHidden}
						{canManage}
						{onedit}
						{onreserve}
						{onunreserve}
						{onreceived}
						{receivedPendingGiftIds}
					/>
				{/if}
			</div>
		{/snippet}
	</ContextMenu.Trigger>
{/snippet}

<ContextMenu.Root
	bind:open={nativeContextOpen}
	onOpenChange={(open) => {
		if (open === true) {
			openedNativeSessionId = nativeContextSessionId;
		}
	}}
	onOpenChangeComplete={(open) => {
		if (open === false) {
			onnativecontextcomplete?.(openedNativeSessionId);
		}
	}}
>
	<div bind:this={motionHost} data-gift-motion-host>
		{#if isLoading}
			<div
				class="gift-card-skeleton-grid grid grid-cols-2 gap-2 sm:gap-5 sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]"
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
			{@render giftCollection()}
		{/if}
	</div>
	{#if contextContent}{@render contextContent()}{/if}
</ContextMenu.Root>

<style>
	@media (width <= 320px) {
		.gift-card-skeleton-grid {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
		}
	}
</style>
