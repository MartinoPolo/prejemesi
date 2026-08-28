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
		class?: string;
	}

	let {
		items,
		clearAllLabel,
		onclearall,
		removeFilterLabel,
		triggerElement = null,
		disabled = false,
		class: className,
	}: ActiveFilterPillsProps = $props();

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

<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} data-filter-pills>
	{#each items as item (item.id)}
		<SimpleTooltip text={item.label}>
			<span
				class="active-filter-pill inline-flex h-(--size-control-sm) min-w-0 max-w-[min(12.5rem,100%)] items-center gap-1 rounded-full border-2 border-ink bg-primary py-0 pr-0.5 pl-2.5 text-(length:--text-sm) font-semibold text-primary-foreground"
				data-active-filter-pill
			>
				<span class="min-w-0 truncate">{item.label}</span>
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
		</SimpleTooltip>
	{/each}
	<Button size="sm" intent="ghost" class="min-w-0 max-w-full" {disabled} onclick={clearAllFilters}
		>{clearAllLabel}</Button
	>
</div>

<style>
	@keyframes filter-acknowledge {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.active-filter-pill {
			animation: filter-acknowledge 220ms cubic-bezier(0.2, 0.7, 0.3, 1);
		}
	}
</style>
