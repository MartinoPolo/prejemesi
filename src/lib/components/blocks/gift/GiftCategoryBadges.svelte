<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { badgeShape } from '$lib/components/base/badge/index.js';
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils.js';
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
	}

	let { categories, isDimmed = false, interactive = true }: Props = $props();

	const popoverTitleId = $props.id();
	let measurement = $state<CategoryLaneMeasurement | null>(null);

	// Until the lane is measured (SSR, first frame), the primary and "+X" always fit.
	const layout = $derived(
		measurement !== null && measurement.badgeWidths.length === categories.length
			? fitCategoryLane(measurement)
			: { visibleCount: 1, moreOnOwnLine: false },
	);
	const visibleCategories = $derived(categories.slice(0, layout.visibleCount));
	const hiddenCategories = $derived(categories.slice(layout.visibleCount));
	const locale = $derived(getLocale().startsWith('en') ? 'en' : 'cs');
	const hiddenLabels = $derived(
		hiddenCategories.map((category) => labelForGiftCategory(category, locale)).join(', '),
	);
	const moreChipClass = $derived(
		cn(
			badgeShape,
			'inline-flex shrink-0 items-center border-ink bg-card px-2 py-0.5 text-xs leading-4 font-extrabold whitespace-nowrap text-foreground',
			isDimmed && 'opacity-50',
		),
	);

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

	function keepPressOffCard(event: MouseEvent) {
		event.stopPropagation();
	}
</script>

{#if categories.length === 1}
	<GiftCategoryBadge category={categories[0]} {isDimmed} />
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
					<GiftCategoryBadge {category} singleLine class="max-w-none" />
				{/each}
				<span class={moreChipClass}>+{categories.length - 1}</span>
			</div>
		</div>

		<div
			class={cn(
				'flex min-w-0 gap-1',
				layout.moreOnOwnLine ? 'flex-col items-start' : 'items-start',
			)}
			data-more-on-own-line={layout.moreOnOwnLine || undefined}
		>
			{#each visibleCategories as category, index (category.id)}
				<GiftCategoryBadge
					{category}
					{isDimmed}
					singleLine
					class={index === 0 ? 'min-w-0' : 'shrink-0'}
				/>
			{/each}
			{#if hiddenCategories.length > 0}
				<span class="sr-only">{hiddenLabels}</span>
				{#if interactive}
					<Popover.Root>
						<Popover.Trigger
							openOnHover
							class={cn(
								moreChipClass,
								'cursor-pointer hover:bg-[color-mix(in_oklab,var(--brand)_12%,var(--card))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
							)}
							aria-label={m.gift_category_more_label({
								count: hiddenCategories.length,
							})}
							data-testid="gift-category-more"
							onclick={keepPressOffCard}
						>
							+{hiddenCategories.length}
						</Popover.Trigger>
						<Popover.Content
							class="w-max max-w-[min(18rem,calc(100vw-1rem))] min-w-0"
							shadowedTrigger={false}
							role="dialog"
							aria-labelledby={popoverTitleId}
							data-testid="gift-category-popover"
						>
							<Popover.Label id={popoverTitleId}>
								{m.gift_category_more_title()}
							</Popover.Label>
							<ul class="m-0 flex list-none flex-wrap gap-1.5 px-2 pt-0.5 pb-1.5">
								{#each categories as category (category.id)}
									<li class="max-w-full min-w-0">
										<GiftCategoryBadge {category} />
									</li>
								{/each}
							</ul>
						</Popover.Content>
					</Popover.Root>
				{:else}
					<span class={moreChipClass} aria-hidden="true">+{hiddenCategories.length}</span>
				{/if}
			{/if}
		</div>
	</div>
{/if}
