<script lang="ts">
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { prefersReducedMotion } from 'svelte/motion';
	import * as Carousel from '$lib/components/base/carousel/index.js';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import { GIFT_CARD_DENSITIES } from '$lib/components/blocks/gift/gift_card_variants.js';
	import { formatGiftCount } from '$lib/modules/gifts/gift_display.js';
	import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import type { GiftCardColumnOption } from '$lib/modules/gifts/types.js';
	import * as m from '$lib/paraglide/messages.js';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import {
		carouselSectionId,
		currentCarouselRowIndex,
		isScrolledToBottom,
		nearestInlineScrollLeft,
		observeStickyLineCrossings,
		trackVisibleCardRange,
		verticalScrollContainerOf,
		type VisibleCardRange,
	} from './gift_carousel_navigation.js';
	import { giftCarouselJumpVariants } from './gift_carousel_jump_variants.js';
	import { giftSectionLabel } from './gift_section_label.js';
	import { toGiftCarouselRows, type GiftCarouselRow } from './gift_section_rows.js';
	import {
		createWishlistGiftCollectionView,
		type WishlistGiftCollectionProps,
	} from './wishlist_gift_collection.svelte.js';
	import { getWishlistStickyChrome } from './wishlist_sticky_chrome.svelte.js';

	interface WishlistGiftCarouselProps extends WishlistGiftCollectionProps {
		/** Card grid options the collection host passes to every view; Carousel rows ignore them. */
		columnOption?: GiftCardColumnOption;
		oncolumncapacitychange?: (largestFittingColumnCount: number | null) => void;
	}

	let collection: WishlistGiftCarouselProps = $props();

	let carouselElement = $state<HTMLElement | null>(null);
	let jumpBarElement = $state<HTMLElement | null>(null);
	let jumpBarHeight = $state(0);
	let trackedRowKey = $state<string | null>(null);
	const rowPositions = $state<Record<string, string>>({});

	// Reorder and selection present the Card grid, so Carousel rows only browse.
	const collectionView = createWishlistGiftCollectionView(
		() => ({ ...collection, reorderEnabled: false, selectionMode: false }),
		() => carouselElement,
	);
	const carouselRows = $derived(toGiftCarouselRows(collectionView.displayRows));
	// A string compares by value, so live gift updates that keep the rows do not rerun its readers.
	const carouselRowKeysJson = $derived(
		JSON.stringify(carouselRows.map((carouselRow) => carouselRow.key)),
	);
	const showsJumpBar = $derived(carouselRows.length > 1);
	const currentRowKey = $derived(
		carouselRows.some((carouselRow) => carouselRow.key === trackedRowKey)
			? trackedRowKey
			: (carouselRows[0]?.key ?? null),
	);

	const stickyChrome = getWishlistStickyChrome();
	const chromeTop = $derived(stickyChrome?.toolbarBottom ?? 0);
	/** Where content stops being covered: the sticky chrome above the rows plus the jump bar. */
	const stickyOffset = $derived(chromeTop + (showsJumpBar ? jumpBarHeight : 0));

	const jumpStyles = giftCarouselJumpVariants();

	function rowName(section: GiftSection): string {
		const label = giftSectionLabel(section);
		return label === '' ? m.gift_carousel_ungrouped_label() : label;
	}

	function rowLabel(carouselRow: GiftCarouselRow): string {
		return `${rowName(carouselRow.section)}, ${formatGiftCount(carouselRow.giftRows.length)}`;
	}

	function headingId(rowKey: string): string {
		return `${carouselSectionId(rowKey)}-heading`;
	}

	function rowRegionId(rowKey: string): string {
		return `${carouselSectionId(rowKey)}-row`;
	}

	function positionText(range: VisibleCardRange | null): string {
		return range === null ? '' : m.gift_carousel_position(range);
	}

	function trackRowPosition(rowKey: string): Attachment<HTMLElement> {
		const trackRange = trackVisibleCardRange(
			(range) => (rowPositions[rowKey] = positionText(range)),
		);
		return (track) => {
			const stopTracking = trackRange(track);
			return () => {
				stopTracking?.();
				delete rowPositions[rowKey];
			};
		};
	}

	/** Jumps without a history entry; modified clicks keep the browser's link behaviour. */
	function jumpToRow(event: MouseEvent, rowKey: string) {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const section = carouselElement?.querySelector<HTMLElement>(
			`#${carouselSectionId(rowKey)}`,
		);
		if (section === null || section === undefined) {
			return;
		}
		event.preventDefault();
		// A count-only row has no heading, so its labelled row region takes focus.
		const focusTarget =
			section.querySelector<HTMLElement>(`#${headingId(rowKey)}`) ??
			section.querySelector<HTMLElement>(`#${rowRegionId(rowKey)}`);
		focusTarget?.focus({ preventScroll: true });
		section.scrollIntoView({
			block: 'start',
			inline: 'nearest',
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth',
		});
	}

	$effect(() => {
		if (stickyChrome === undefined || !showsJumpBar) {
			return;
		}
		untrack(() => (stickyChrome.stripsBelowToolbar += 1));
		return () => (stickyChrome.stripsBelowToolbar -= 1);
	});

	// Header crossings of the sticky line drive the current row; the scroll listener only notices
	// reaching the page bottom, which a short last row never crosses the line for.
	$effect(() => {
		const element = carouselElement;
		const rowKeys: string[] = JSON.parse(carouselRowKeysJson);
		const stickyLineOffset = stickyOffset;
		if (element === null || rowKeys.length < 2) {
			return;
		}
		const headers = Array.from(
			element.querySelectorAll<HTMLElement>('[data-gift-carousel-header]'),
		);
		const scrollContainer = verticalScrollContainerOf(element);
		const scrollMetrics =
			scrollContainer ?? document.scrollingElement ?? document.documentElement;
		const scrollEventTarget = scrollContainer ?? window;
		let scrolledToBottom = false;

		const updateCurrentRow = () => {
			const scrollContainerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
			const currentIndex = currentCarouselRowIndex(
				headers.map((header) => header.getBoundingClientRect().top),
				scrollContainerTop + stickyLineOffset,
				scrolledToBottom,
			);
			trackedRowKey = rowKeys[currentIndex] ?? null;
		};
		const updateScrolledToBottom = () => {
			const atBottom = isScrolledToBottom(
				scrollMetrics.scrollTop,
				scrollMetrics.clientHeight,
				scrollMetrics.scrollHeight,
			);
			if (atBottom !== scrolledToBottom) {
				scrolledToBottom = atBottom;
				updateCurrentRow();
			}
		};

		const intersectionObserver = observeStickyLineCrossings(
			headers,
			scrollContainer,
			stickyLineOffset,
			updateCurrentRow,
		);
		scrollEventTarget.addEventListener('scroll', updateScrolledToBottom, { passive: true });
		updateScrolledToBottom();
		return () => {
			intersectionObserver.disconnect();
			scrollEventTarget.removeEventListener('scroll', updateScrolledToBottom);
		};
	});

	// Scrolls only the jump bar, never the page, so the reader's vertical position is untouched.
	$effect(() => {
		const jumpBar = jumpBarElement;
		if (jumpBar === null || currentRowKey === null) {
			return;
		}
		const currentChip = jumpBar.querySelector<HTMLElement>('[aria-current="location"]');
		if (currentChip === null) {
			return;
		}
		const jumpBarBox = jumpBar.getBoundingClientRect();
		const chipBox = currentChip.getBoundingClientRect();
		const chipStart = chipBox.left - jumpBarBox.left - jumpBar.clientLeft + jumpBar.scrollLeft;
		const targetScrollLeft = nearestInlineScrollLeft(
			jumpBar.scrollLeft,
			jumpBar.clientWidth,
			chipStart,
			chipStart + chipBox.width,
			parseFloat(getComputedStyle(jumpBar).paddingLeft),
		);
		if (targetScrollLeft !== jumpBar.scrollLeft) {
			jumpBar.scrollTo({ left: targetScrollLeft, behavior: 'instant' });
		}
	});
</script>

<div
	bind:this={carouselElement}
	class="gift-carousel"
	style:--gift-carousel-chrome-top="{chromeTop}px"
	style:--gift-carousel-sticky-offset="{stickyOffset}px"
	data-testid="wishlist-gift-carousel"
>
	{#if showsJumpBar}
		<nav
			bind:this={jumpBarElement}
			bind:offsetHeight={jumpBarHeight}
			class={jumpStyles.bar()}
			aria-label={m.gift_carousel_jump_aria()}
		>
			{#each carouselRows as carouselRow (carouselRow.key)}
				<a
					href="#{carouselSectionId(carouselRow.key)}"
					class={jumpStyles.link()}
					aria-current={carouselRow.key === currentRowKey ? 'location' : undefined}
					aria-label={rowLabel(carouselRow)}
					onclick={(event) => jumpToRow(event, carouselRow.key)}
				>
					<span class={jumpStyles.face()}>
						{rowName(carouselRow.section)}
						<span class={jumpStyles.count()}>{carouselRow.giftRows.length}</span>
					</span>
				</a>
			{/each}
		</nav>
	{/if}
	{#each carouselRows as carouselRow (carouselRow.key)}
		<div
			id={carouselSectionId(carouselRow.key)}
			class="gift-carousel-group"
			data-testid="gift-carousel-group"
		>
			<div class="gift-carousel-header" data-gift-carousel-header>
				<GiftSectionHeader
					{...collectionView.sectionHeaderProps(carouselRow.section)}
					count={carouselRow.giftRows.length}
					position={rowPositions[carouselRow.key]}
					jumpTargetId={headingId(carouselRow.key)}
				/>
			</div>
			<Carousel.Root
				id={rowRegionId(carouselRow.key)}
				tabindex={0}
				aria-roledescription={m.gift_carousel_roledescription()}
				aria-label={rowLabel(carouselRow)}
				class="gift-carousel-row focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
				data-testid="gift-carousel-row"
			>
				<Carousel.Content
					class="gift-carousel-track"
					{@attach trackRowPosition(carouselRow.key)}
				>
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

		scroll-margin-top: var(--gift-carousel-sticky-offset);
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

	/* Margin rather than padding keeps the group's top edge on its header, so a jump aligns the
	   header with the sticky line that decides the current row. */
	.gift-carousel-group:not(:first-child) {
		margin-top: 0.5rem;
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
