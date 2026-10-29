<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Carousel from '$lib/components/base/carousel/index.js';
	import ViewAllCard from './ViewAllCard.svelte';
	import { HOME_SHELF_SIZES, type HomeShelfSize } from './home_shelf_sizes.js';
	import * as m from '$lib/paraglide/messages.js';

	interface HomeShelfProps {
		title: string;
		/** `large` for the prominent „Nedávné" row, `compact` for the category rows. */
		size: HomeShelfSize;
		/** Optional leading icon (e.g. a clock for „Nedávné"). */
		icon?: Snippet;
		/** Category page link — absent for „Nedávné", which has no full page. */
		viewAllHref?: string;
		/** True (uncapped, non-archived) count for the „Zobrazit vše (N)" link + trailing card. */
		total?: number;
		/** Number of card slides the row actually renders (drives the trailing „+N" count). */
		visibleCount: number;
		/** The Carousel.Item card slides. */
		children: Snippet;
	}

	let {
		title,
		size,
		icon,
		viewAllHref,
		total = 0,
		visibleCount,
		children,
	}: HomeShelfProps = $props();

	const presentation = $derived(HOME_SHELF_SIZES[size]);

	// The trailing „Zobrazit vše" card appears only when the row was capped (more lists exist).
	const remaining = $derived(Math.max(0, total - visibleCount));
	const showTrailingCard = $derived(viewAllHref !== undefined && remaining > 0);

	let canScrollPrev = $state(false);
	// Drives the right-edge fade: while more cards exist past the viewport, a mask gradient
	// signals scrollable content; it clears once the row is scrolled to the end (or fits).
	let canScrollNext = $state(false);
	// The arrow pair is shown only when the row overflows (either direction scrollable).
	const canScroll = $derived(canScrollPrev || canScrollNext);
</script>

<section
	class={['shelf', `shelf-${size}`]}
	data-testid="home-shelf"
	data-can-scroll-next={canScrollNext}
>
	<Carousel.Root bind:canScrollPrev bind:canScrollNext>
		<div class="shelf-head">
			<h2 class="shelf-title">
				{#if icon}
					<span class="shelf-icon" aria-hidden="true">{@render icon()}</span>
				{/if}
				{title}
			</h2>
			{#if viewAllHref !== undefined}
				<a class="shelf-link" href={viewAllHref} data-testid="shelf-view-all-link">
					{m.home_view_all_count({ count: total })}
				</a>
			{/if}
			{#if canScroll}
				<div class="shelf-controls">
					<Carousel.Previous size={presentation.arrowSize} />
					<Carousel.Next size={presentation.arrowSize} />
				</div>
			{/if}
		</div>

		<Carousel.Content class="shelf-track">
			{@render children()}
			{#if showTrailingCard && viewAllHref !== undefined}
				<Carousel.Item class={presentation.trailingSlideClass}>
					<ViewAllCard href={viewAllHref} {remaining} />
				</Carousel.Item>
			{/if}
		</Carousel.Content>
	</Carousel.Root>
</section>

<style>
	.shelf-large {
		margin-bottom: var(--space-10);
	}

	.shelf-compact {
		margin-bottom: 28px;
	}

	.shelf-head {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: var(--space-3);
	}

	.shelf-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-heading);
		font-weight: var(--weight-semibold);
	}

	.shelf-large .shelf-title {
		font-size: var(--text-3xl);
	}

	.shelf-compact .shelf-title {
		font-size: var(--text-xl);
	}

	.shelf-icon {
		display: inline-flex;
		align-items: center;
	}

	/* The „Nedávné" icon is a tilted sticker; brand colors the icon only, never text. */
	.shelf-large .shelf-icon {
		width: 40px;
		height: 40px;
		flex: none;
		justify-content: center;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--accent);
		color: var(--brand);
		rotate: -6deg;
		box-shadow: var(--elevation-compact);
	}

	.shelf-large .shelf-icon :global(svg) {
		width: 26px;
		height: 26px;
	}

	.shelf-link {
		font-size: var(--text-md);
		font-weight: 700;
		color: var(--brand-link);
		border-bottom: 2px dotted var(--ink-faint);
	}

	.shelf-compact .shelf-link {
		font-size: var(--text-sm);
	}

	@media (width < 640px) {
		.shelf-large .shelf-title {
			font-size: 24px;
		}

		.shelf-compact .shelf-title {
			font-size: 16px;
		}

		.shelf-large .shelf-icon {
			width: 34px;
			height: 34px;
		}

		.shelf-large .shelf-icon :global(svg) {
			width: 22px;
			height: 22px;
		}
	}

	.shelf-controls {
		margin-left: auto;
		display: flex;
		gap: 6px;
	}

	/* Bleed the viewport through the content padding to the page edge so the cut-off card is flush
	   with it, and pad the scrolling viewport vertically so the card hover-lift and hard shadows
	   are not clipped (issue #225 peek geometry). Slides size from this visible row width. */
	.shelf :global([data-slot='carousel-content']) {
		container-type: inline-size;
		margin-right: calc(var(--page-gutter) * -1);
		padding: 6px 0 14px;
	}

	/* Right-edge fade signalling more cards past the clip. Only while the row can still scroll
	   right — when scrolled to the end (or it fits), the last card renders un-faded. Desktop and
	   mobile alike; keyed off the data attribute so it stays e2e-testable. */
	.shelf[data-can-scroll-next='true'] :global([data-slot='carousel-content']) {
		mask-image: linear-gradient(to right, #000 calc(100% - 56px), transparent 100%);
	}
</style>
