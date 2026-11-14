<script lang="ts">
	import { tick } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import { cn } from '$lib/utils.js';
	import type { ActiveFilterItem } from './active_filters.js';

	interface ActiveFilterPillsProps {
		items: readonly ActiveFilterItem[];
		clearAllLabel: string;
		onclearall: () => void;
		removeFilterLabel: (label: string) => string;
		triggerElement?: HTMLButtonElement | null;
		disabled?: boolean;
		/** `scroll` keeps one horizontally scrolling row whose whole pills are touch-sized remove targets. */
		layout?: 'wrap' | 'scroll';
		class?: string;
	}

	let {
		items,
		clearAllLabel,
		onclearall,
		removeFilterLabel,
		triggerElement = null,
		disabled = false,
		layout = 'wrap',
		class: className,
	}: ActiveFilterPillsProps = $props();

	const PILL_FACE_CLASS =
		'inline-flex h-(--size-control-sm) min-w-0 max-w-[min(12.5rem,100%)] items-center gap-1 rounded-full border-2 border-edge bg-primary py-0 pr-0.5 pl-2.5 text-(length:--text-sm) font-semibold text-primary-foreground';

	let pillRemoveButtons = $state<Record<string, HTMLButtonElement | undefined>>({});

	async function clearAllFilters() {
		onclearall();
		await tick();
		triggerElement?.focus();
	}

	async function removeActiveFilter(item: ActiveFilterItem) {
		const activeIndex = items.findIndex(({ id }) => id === item.id);
		const nextActiveFilterId = items.at(activeIndex + 1)?.id;
		const previousActiveFilterId = activeIndex > 0 ? items.at(activeIndex - 1)?.id : undefined;

		item.onremove();
		await tick();
		(nextActiveFilterId !== undefined
			? pillRemoveButtons[nextActiveFilterId]
			: previousActiveFilterId !== undefined
				? pillRemoveButtons[previousActiveFilterId]
				: triggerElement
		)?.focus();
	}
</script>

{#snippet pillLabel(item: ActiveFilterItem)}
	<span class="min-w-0 truncate">{item.label}</span>
{/snippet}

{#snippet clearAllButton(buttonClass: string)}
	<Button size="sm" intent="ghost" class={buttonClass} {disabled} onclick={clearAllFilters}
		>{clearAllLabel}</Button
	>
{/snippet}

{#if layout === 'scroll'}
	<div
		class={cn(
			'active-filter-scroll-row flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap',
			className,
		)}
		data-filter-pills
	>
		{#each items as item (item.id)}
			<button
				bind:this={pillRemoveButtons[item.id]}
				type="button"
				{disabled}
				class="group inline-flex h-(--size-control-lg) shrink-0 cursor-pointer items-center outline-none disabled:cursor-not-allowed disabled:opacity-45"
				aria-label={removeFilterLabel(item.label)}
				title={item.label}
				onclick={() => removeActiveFilter(item)}
			>
				<span
					class={cn(
						PILL_FACE_CLASS,
						'group-focus-visible:outline-2 group-focus-visible:outline-solid group-focus-visible:outline-offset-2 group-focus-visible:outline-ring',
					)}
					data-active-filter-pill
				>
					{@render pillLabel(item)}
					<span
						class="grid size-6 shrink-0 place-items-center rounded-full text-current group-hover:bg-[color-mix(in_oklab,currentColor_24%,transparent)]"
					>
						<XIcon class="size-3.5" />
					</span>
				</span>
			</button>
		{/each}
		{@render clearAllButton('h-(--size-control-lg)')}
	</div>
{:else}
	<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} data-filter-pills>
		{#each items as item (item.id)}
			<SimpleTooltip text={item.label}>
				{#snippet asChild(triggerProps)}
					<span {...triggerProps} class={PILL_FACE_CLASS} data-active-filter-pill>
						{@render pillLabel(item)}
						<button
							bind:this={pillRemoveButtons[item.id]}
							type="button"
							{disabled}
							class="grid size-6 shrink-0 place-items-center rounded-full text-current hover:bg-[color-mix(in_oklab,currentColor_24%,transparent)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-current"
							aria-label={removeFilterLabel(item.label)}
							onclick={() => removeActiveFilter(item)}
						>
							<XIcon class="size-3.5" />
						</button>
					</span>
				{/snippet}
			</SimpleTooltip>
		{/each}
		{@render clearAllButton('min-w-0 max-w-full')}
	</div>
{/if}

<style>
	.active-filter-scroll-row {
		scrollbar-width: none;
	}

	.active-filter-scroll-row::-webkit-scrollbar {
		display: none;
	}

	@keyframes filter-acknowledge {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		[data-active-filter-pill] {
			animation: filter-acknowledge 220ms cubic-bezier(0.2, 0.7, 0.3, 1);
		}
	}
</style>
