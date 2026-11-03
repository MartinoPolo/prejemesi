<script lang="ts">
	import * as Carousel from '$lib/components/base/carousel/index.js';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import { GIFT_CARD_DENSITIES } from '$lib/components/blocks/gift/gift_card_variants.js';
	import { formatGiftCount } from '$lib/modules/gifts/gift_display.js';
	import type { GiftCardColumnOption } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import { giftSectionLabel } from './gift_section_label.js';
	import { toGiftCarouselRows } from './gift_section_rows.js';
	import {
		createWishlistGiftCollectionView,
		type WishlistGiftCollectionProps,
	} from './wishlist_gift_collection.svelte.js';

	interface WishlistGiftCarouselProps extends WishlistGiftCollectionProps {
		/** Card grid options the collection host passes to every view; Carousel rows ignore them. */
		columnOption?: GiftCardColumnOption;
		oncolumncapacitychange?: (largestFittingColumnCount: number | null) => void;
	}

	let collection: WishlistGiftCarouselProps = $props();

	let carouselElement = $state<HTMLElement | null>(null);

	// Reorder and selection present the Card grid, so Carousel rows only browse.
	const collectionView = createWishlistGiftCollectionView(
		() => ({ ...collection, reorderEnabled: false, selectionMode: false }),
		() => carouselElement,
	);
	const carouselRows = $derived(toGiftCarouselRows(collectionView.displayRows));

	function rowLabel(label: string, count: number): string {
		const countLabel = formatGiftCount(count);
		return label === ''
			? m.gift_carousel_row_ungrouped_label({ count: countLabel })
			: `${label}, ${countLabel}`;
	}
</script>

<div bind:this={carouselElement} class="gift-carousel" data-testid="wishlist-gift-carousel">
	{#each carouselRows as carouselRow (carouselRow.key)}
		<div class="gift-carousel-group" data-testid="gift-carousel-group">
			<div class="gift-carousel-header">
				<GiftSectionHeader
					{...collectionView.sectionHeaderProps(carouselRow.section)}
					count={carouselRow.giftRows.length}
				/>
			</div>
			<Carousel.Root
				tabindex={0}
				aria-roledescription={m.gift_carousel_roledescription()}
				aria-label={rowLabel(
					giftSectionLabel(carouselRow.section),
					carouselRow.giftRows.length,
				)}
				class="gift-carousel-row focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
				data-testid="gift-carousel-row"
			>
				<Carousel.Content class="gift-carousel-track">
					{#each carouselRow.giftRows as giftRow (giftRow.key)}
						<Carousel.Item
							class="gift-carousel-slide"
							data-testid="gift-carousel-slide"
						>
							<WishlistGiftItem
								{...collectionView.giftItemProps(giftRow)}
								class="min-w-0"
								dragOverStyle="ring"
							>
								{#snippet children(giftItem)}
									<GiftCard
										{...collectionView.giftPresentationProps(giftItem)}
										density={GIFT_CARD_DENSITIES.carousel}
									/>
								{/snippet}
							</WishlistGiftItem>
						</Carousel.Item>
					{/each}
				</Carousel.Content>
			</Carousel.Root>
		</div>
	{/each}
</div>

<style>
	/* The rows bleed through the page gutter to the screen edges, so this box is the screen width
	   the card width derives from. */
	.gift-carousel {
		container: gift-carousel / inline-size;
		margin-inline: calc(var(--page-gutter) * -1);
	}

	/* Whole cards plus a fixed fraction of the next one, so every width shows a peek at the right
	   edge: card = (100cqi − gutter − N × gap) / (N + peek). */
	.gift-carousel-group {
		--gift-carousel-full-cards: 2;
		--gift-carousel-peek: 0.2;
		--gift-carousel-card-width: calc(
			(
					100cqi - var(--page-gutter) - var(--gift-carousel-full-cards) *
						var(--gift-card-grid-gap)
				) /
				(var(--gift-carousel-full-cards) + var(--gift-carousel-peek))
		);
	}

	@container gift-carousel (width < 360px) {
		.gift-carousel-group {
			--gift-carousel-full-cards: 1;
			--gift-carousel-peek: 0.5;
		}
	}

	@container gift-carousel (width >= 540px) {
		.gift-carousel-group {
			--gift-carousel-full-cards: 3;
		}
	}

	.gift-carousel-group + .gift-carousel-group {
		padding-top: 0.5rem;
	}

	.gift-carousel-header {
		padding-inline: var(--page-gutter);
	}

	.gift-carousel-group :global([data-slot='carousel-content']) {
		scroll-padding-inline: var(--page-gutter);
	}

	/* The track is as wide as its cards so its padding stays inside the scrollable area: the
	   inline padding starts the first card and ends the last one on the gutter, and the block
	   padding holds every resting shadow, hover lift and focus ring inside the scroller. */
	.gift-carousel-group :global(.gift-carousel-track) {
		width: max-content;
		gap: var(--gift-card-grid-gap);
		margin-inline-start: 0;
		padding: 6px var(--page-gutter);
	}

	.gift-carousel-group :global(.gift-carousel-slide) {
		flex: none;
		width: var(--gift-carousel-card-width);
		padding-inline-start: 0;
	}
</style>
