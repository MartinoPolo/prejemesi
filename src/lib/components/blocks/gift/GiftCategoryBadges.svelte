<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { badgeVariants } from '$lib/components/base/badge/index.js';
	import { OverflowChips } from '$lib/components/derived/overflow-chips/index.js';
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import GiftCategoryBadge from './GiftCategoryBadge.svelte';
	import {
		PRIMARY_CATEGORY_READABLE_WIDTH_REM,
		fitCategoryLane,
		type CategoryLaneMeasurement,
	} from './gift_category_lane_layout.js';

	interface Props {
		/** The gift's categories in order; the first is the primary. */
		categories: readonly PublicGiftCategory[];
		isDimmed?: boolean;
		/** When false, "+X" is a static chip so a card's selection or reorder press owns it. */
		interactive?: boolean;
		/** Keeps a lone category on one line with an ellipsis, e.g. when a corner chip narrows its lane. */
		singleLine?: boolean;
	}

	let { categories, isDimmed = false, interactive = true, singleLine = false }: Props = $props();

	let measurement = $state<CategoryLaneMeasurement | null>(null);

	// Until the lane is measured (SSR, first frame), the primary and "+X" always fit.
	const layout = $derived(
		measurement !== null && measurement.badgeWidths.length === categories.length
			? fitCategoryLane(measurement)
			: { visibleCount: 1, moreOnOwnLine: false },
	);
	const locale = $derived(getLocale().startsWith('en') ? 'en' : 'cs');

	function observeLane(lane: HTMLElement) {
		// Reading the categories re-attaches on any change, so a same-size swap is measured again.
		void categories.map((category) => category.id);
		const measuringRow = lane.querySelector<HTMLElement>('[data-category-measuring-row]');
		if (measuringRow === null) {
			return;
		}
		const resizeObserver = new ResizeObserver(() => {
			const rowItems = Array.from(measuringRow.children, (item) =>
				item instanceof HTMLElement ? item.getBoundingClientRect().width : 0,
			);
			const rootFontSize = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			measurement = {
				laneWidth: lane.getBoundingClientRect().width,
				badgeWidths: rowItems.slice(0, -1),
				moreWidth: rowItems.at(-1) ?? 0,
				gap: Number.parseFloat(getComputedStyle(measuringRow).columnGap) || 0,
				primaryReadableWidth: PRIMARY_CATEGORY_READABLE_WIDTH_REM * rootFontSize,
			};
		});
		// The measuring row resizes when labels change or fonts load; the lane when columns do.
		resizeObserver.observe(lane);
		resizeObserver.observe(measuringRow);
		return () => resizeObserver.disconnect();
	}
</script>

{#if categories.length === 1}
	<GiftCategoryBadge category={categories[0]} {isDimmed} {singleLine} />
{:else if categories.length > 1}
	<div
		class="relative w-full min-w-0"
		role="group"
		aria-label={m.gift_category_label()}
		data-testid="gift-category-badges"
		{@attach observeLane}
	>
		<!-- Natural one-line widths, clipped so the hidden row never widens the page. -->
		<div
			class="pointer-events-none invisible absolute inset-0 overflow-hidden"
			aria-hidden="true"
			inert
		>
			<div class="flex w-max gap-1" data-category-measuring-row>
				{#each categories as category (category.id)}
					<GiftCategoryBadge
						{category}
						singleLine
						testId="gift-category-badge-measure"
						class="max-w-none"
					/>
				{/each}
				<span class={badgeVariants({ tone: 'neutral' })}>+{categories.length - 1}</span>
			</div>
		</div>

		<OverflowChips
			items={categories}
			visibleCount={layout.visibleCount}
			itemKey={(category) => category.id}
			itemLabel={(category) => labelForGiftCategory(category, locale)}
			moreLabel={(count) => m.gift_category_more_label({ count })}
			popoverTitle={m.gift_category_more_title()}
			{interactive}
			dimmed={isDimmed}
			layout={layout.moreOnOwnLine ? 'stacked' : 'inline'}
			data-more-on-own-line={layout.moreOnOwnLine || undefined}
		>
			{#snippet chip(category, index)}
				<GiftCategoryBadge
					{category}
					{isDimmed}
					singleLine
					class={index === 0 ? 'min-w-0' : 'shrink-0'}
				/>
			{/snippet}
			{#snippet popoverChip(category)}
				<GiftCategoryBadge {category} />
			{/snippet}
		</OverflowChips>
	</div>
{/if}
