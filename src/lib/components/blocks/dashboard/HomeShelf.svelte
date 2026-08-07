<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Carousel from '$lib/components/base/carousel/index.js';
	import type { CarouselAPI } from '$lib/components/base/carousel/context.js';
	import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
	import ViewAllCard from './ViewAllCard.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface HomeShelfProps {
		title: string;
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

	let { title, icon, viewAllHref, total = 0, visibleCount, children }: HomeShelfProps = $props();

	// Plain vertical wheel keeps scrolling the page — only horizontal deltas move the shelf.
	const plugins = [WheelGesturesPlugin({ forceWheelAxis: 'x' })];

	// The trailing „Zobrazit vše" card appears only when the row was capped (more lists exist).
	const remaining = $derived(Math.max(0, total - visibleCount));
	const showTrailingCard = $derived(viewAllHref !== undefined && remaining > 0);

	// The arrow pair is shown only when the row overflows (either direction scrollable). Tracked
	// off the embla api because canScrollPrev/Next live in carousel context, not here.
	let canScroll = $state(false);
	function trackApi(api: CarouselAPI | undefined) {
		if (api === undefined) {
			return;
		}
		const update = () => {
			canScroll = api.canScrollPrev() || api.canScrollNext();
		};
		update();
		api.on('select', update);
		api.on('reInit', update);
	}
</script>

<section class="shelf" data-testid="home-shelf">
	<Carousel.Root opts={{ align: 'start' }} {plugins} setApi={trackApi}>
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
					<Carousel.Previous />
					<Carousel.Next />
				</div>
			{/if}
		</div>

		<Carousel.Content class="shelf-track">
			{@render children()}
			{#if showTrailingCard && viewAllHref !== undefined}
				<Carousel.Item class="basis-[200px]">
					<ViewAllCard href={viewAllHref} {remaining} />
				</Carousel.Item>
			{/if}
		</Carousel.Content>
	</Carousel.Root>
</section>

<style>
	.shelf {
		margin-bottom: var(--space-10);
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
		font-size: var(--text-2xl);
		font-weight: var(--weight-semibold);
	}

	.shelf-icon {
		display: inline-flex;
		align-items: center;
	}

	.shelf-link {
		font-size: var(--text-md);
		font-weight: 700;
		color: var(--brand-deep);
		border-bottom: 2px dotted var(--ink-faint);
	}

	.shelf-controls {
		margin-left: auto;
		display: flex;
		gap: 6px;
	}

	/* Bleed the viewport to the content-padding right edge so the cut-off card is flush with the
	   page edge, and pad the overflow-hidden viewport vertically so the card hover-lift and hard
	   shadows are not clipped (issue #225 peek geometry). */
	.shelf :global([data-slot='carousel-content']) {
		margin-right: calc(var(--space-6) * -1);
		padding: 6px 0 14px;
	}
</style>
