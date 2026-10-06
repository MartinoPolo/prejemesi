<script lang="ts">
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import { giftSectionHasHeader, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import {
		GIFT_CARD_COLUMN_OPTIONS,
		type GiftByRole,
		type GiftCardColumnOption,
		type GiftForVisitor,
	} from '$lib/modules/gifts/types.js';
	import type { GiftContextInvocation } from './gift_context_invocation.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import {
		GIFT_CARD_MINIMUM_WIDTH,
		giftCardChosenColumnCount,
		largestFittingGiftCardColumnCount,
		measureGiftCardGridGeometry,
	} from './gift_card_grid_columns.js';
	import { giftCardGridVariants } from './gift_card_grid_variants.js';
	import {
		toIndexedSections,
		countGiftsInSections,
		sectionRenderKey,
	} from './gift_section_rows.js';

	interface WishlistGiftCardGridProps {
		columnOption?: GiftCardColumnOption;
		/** Reports the largest column count whose cards fit the minimum width; null when unmounted. */
		oncolumncapacitychange?: (largestFittingColumnCount: number | null) => void;
		sections: GiftSection[];
		role: WishlistRole;
		isArchived: boolean;
		hideReservationState: boolean;
		reorderEnabled: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreceived: (giftId: string, received: boolean) => void;
		receivedPendingGiftIds?: ReadonlySet<string>;
		onreorderpreview: (orderedIds: string[]) => void;
		onreordercommit: (orderedIds: string[]) => void;
		onreordercancel: (orderedIds: string[]) => void;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		oncontextactions?: (gift: GiftByRole, invocation: GiftContextInvocation) => boolean;
		hascontextactions?: (gift: GiftByRole) => boolean;
		activeContextGiftId?: string | null;
		contextSurface?: 'menu' | 'dialog';
		showPriority?: boolean;
	}

	let {
		sections,
		role,
		isArchived,
		hideReservationState,
		reorderEnabled,
		onedit,
		onreserve,
		onunreserve,
		onreceived,
		receivedPendingGiftIds = new Set<string>(),
		onreorderpreview,
		onreordercommit,
		onreordercancel,
		selectionMode = false,
		onselectiontoggle,
		oncontextactions,
		hascontextactions,
		activeContextGiftId = null,
		contextSurface = 'menu',
		showPriority = true,
		columnOption = GIFT_CARD_COLUMN_OPTIONS.automatic,
		oncolumncapacitychange,
	}: WishlistGiftCardGridProps = $props();

	let gridEl = $state<HTMLElement | null>(null);
	let reorderAnnouncement = $state('');

	const chosenColumnCount = $derived(giftCardChosenColumnCount(columnOption));
	const indexedSections = $derived(toIndexedSections(sections));
	const totalGiftCount = $derived(countGiftsInSections(sections));

	function getItemElements() {
		return gridEl === null
			? []
			: Array.from(gridEl.querySelectorAll<HTMLElement>('[data-gift-item]'));
	}

	const reorder = createGiftPointerReorderController({
		getItemElements,
		getItemIds: () => getItemElements().map((element) => element.dataset.giftId!),
		onPreviewOrder: (orderedIds) => onreorderpreview(orderedIds),
		onCommitOrder: (orderedIds) => onreordercommit(orderedIds),
		onCancelOrder: (orderedIds) => onreordercancel(orderedIds),
	});

	function handleReorderMove(index: number, direction: -1 | 1) {
		const destination = index + direction;
		if (destination >= 0 && destination < totalGiftCount) {
			if (!reorder.move(index, direction)) {
				return;
			}
			const movedGift = indexedSections
				.flatMap(({ items }) => items)
				.find((item) => item.index === index)?.gift;
			if (movedGift !== undefined) {
				reorderAnnouncement = m.gift_reorder_move_success({
					name: movedGift.name,
					position: destination + 1,
					total: totalGiftCount,
				});
			}
		}
	}

	$effect(() => {
		if (!reorderEnabled) {
			reorder.cancel();
		}
	});
	$effect(() => () => reorder.destroy());

	$effect(() => {
		const grid = gridEl;
		const reportCapacity = oncolumncapacitychange;
		if (grid === null || reportCapacity === undefined) {
			return;
		}
		const observer = new ResizeObserver(() =>
			reportCapacity(largestFittingGiftCardColumnCount(measureGiftCardGridGeometry(grid))),
		);
		observer.observe(grid);
		return () => {
			observer.disconnect();
			reportCapacity(null);
		};
	});
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{reorderAnnouncement}
</div>

<div
	bind:this={gridEl}
	data-testid="wishlist-gift-card-grid"
	style:--gift-card-minimum-width={GIFT_CARD_MINIMUM_WIDTH}
	style:--gift-card-column-count={chosenColumnCount}
	class={cn(
		'gift-card-grid isolate grid auto-rows-auto sm:pb-5',
		giftCardGridVariants({ hasChosenColumnCount: chosenColumnCount !== undefined }),
	)}
>
	{#each indexedSections as { section, items } (sectionRenderKey(section, items))}
		{#if giftSectionHasHeader(section)}
			<!-- Full-width band/group header breaks the auto-fill row so cards flow beneath it. -->
			<div class="col-span-full">
				<GiftSectionHeader {section} {selectionMode} {onselectiontoggle} />
			</div>
		{/if}
		{#each items as { gift: giftItem, index } (giftItem.id)}
			<WishlistGiftItem
				gift={giftItem}
				{index}
				totalCount={totalGiftCount}
				{reorderEnabled}
				class="h-auto! min-w-0 self-stretch"
				draggedGiftId={reorder.draggedGiftId.current}
				dragOverGiftId={reorder.dragOverGiftId.current}
				dragOverStyle="ring"
				{selectionMode}
				{onselectiontoggle}
				{oncontextactions}
				{onedit}
				onreorderpointerdown={reorder.start}
				onreordermove={handleReorderMove}
			>
				{#snippet children(giftItem)}
					<GiftCard
						gift={giftItem}
						{role}
						{isArchived}
						{hideReservationState}
						{showPriority}
						contextualMode={selectionMode || reorderEnabled}
						{onreserve}
						{onunreserve}
						{onreceived}
						receivedPending={receivedPendingGiftIds.has(giftItem.id)}
						moreOpen={activeContextGiftId === giftItem.id}
						moreSurface={contextSurface}
						persistentMore={hascontextactions?.(giftItem) ?? false}
						onmore={oncontextactions !== undefined
							? (anchor, placementSnapshot) =>
									oncontextactions(giftItem, {
										kind: 'more',
										anchor,
										placementSnapshot,
									})
							: undefined}
					/>
				{/snippet}
			</WishlistGiftItem>
		{/each}
	{/each}
</div>

<style>
	@media (width <= 320px) {
		.gift-card-grid {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
			gap: 10px;
		}

		.gift-card-grid > :global([data-gift-item]) {
			height: auto !important;
		}
	}
</style>
