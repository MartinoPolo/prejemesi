<script lang="ts">
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import GiftReorderDropZone from './GiftReorderDropZone.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import {
		createWishlistGiftCollectionView,
		type WishlistGiftCollectionProps,
	} from './wishlist_gift_collection.svelte.js';
	import {
		GIFT_CARD_COLUMN_OPTIONS,
		type GiftCardColumnOption,
	} from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';
	import {
		GIFT_CARD_MINIMUM_WIDTH,
		giftCardChosenColumnCount,
		largestFittingGiftCardColumnCount,
		measureGiftCardGridGeometry,
	} from './gift_card_grid_columns.js';
	import { giftCardGridVariants } from './gift_card_grid_variants.js';
	import { GIFT_DISPLAY_ROW_KINDS } from './gift_section_rows.js';

	interface WishlistGiftCardGridProps extends WishlistGiftCollectionProps {
		columnOption?: GiftCardColumnOption;
		/** Reports the largest column count whose cards fit the minimum width; null when unmounted. */
		oncolumncapacitychange?: (largestFittingColumnCount: number | null) => void;
	}

	let {
		columnOption = GIFT_CARD_COLUMN_OPTIONS.automatic,
		oncolumncapacitychange,
		...collection
	}: WishlistGiftCardGridProps = $props();

	let gridEl = $state<HTMLElement | null>(null);

	const chosenColumnCount = $derived(giftCardChosenColumnCount(columnOption));
	const collectionView = createWishlistGiftCollectionView(
		() => collection,
		() => gridEl,
	);

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
	{collectionView.announcement}
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
	{#each collectionView.displayRows as row (row.key)}
		{#if row.kind === GIFT_DISPLAY_ROW_KINDS.header}
			<!-- Full-width band/group header breaks the auto-fill row so cards flow beneath it. -->
			<div class="col-span-full">
				<GiftSectionHeader {...collectionView.sectionHeaderProps(row.section)} />
			</div>
		{:else if row.kind === GIFT_DISPLAY_ROW_KINDS.dropZone}
			<GiftReorderDropZone groupKey={row.section.key} class="col-span-full" />
		{:else}
			<WishlistGiftItem
				{...collectionView.giftItemProps(row)}
				class="h-auto! min-w-0 self-stretch"
				dragOverStyle="ring"
			>
				{#snippet children(giftItem)}
					<GiftCard {...collectionView.giftPresentationProps(giftItem)} />
				{/snippet}
			</WishlistGiftItem>
		{/if}
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
