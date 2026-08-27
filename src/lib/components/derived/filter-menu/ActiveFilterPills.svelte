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
		class?: string;
	}

	let {
		items,
		clearAllLabel,
		onclearall,
		removeFilterLabel,
		triggerElement = null,
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

		item.onremove();
		await tick();
		(nextActiveFilterId ? pillRemoveButtons[nextActiveFilterId] : triggerElement)?.focus();
	}
</script>

<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} data-filter-pills>
	{#each items as item (item.id)}
		<SimpleTooltip text={item.label}>
			<span
				class="inline-flex h-(--size-control-sm) min-w-0 max-w-[min(12.5rem,100%)] items-center gap-1 rounded-full border-2 border-ink bg-primary py-0 pr-0.5 pl-2.5 text-(length:--text-sm) font-semibold text-primary-foreground"
			>
				<span class="min-w-0 truncate">{item.label}</span>
				<button
					bind:this={pillRemoveButtons[item.id]}
					type="button"
					class="grid size-6 shrink-0 place-items-center rounded-full text-current hover:bg-[color-mix(in_oklab,currentColor_24%,transparent)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-current"
					aria-label={removeFilterLabel(item.label)}
					onclick={() => removeActiveFilter(item)}
				>
					<XIcon class="size-3.5" />
				</button>
			</span>
		</SimpleTooltip>
	{/each}
	<Button
		size="sm"
		intent="ghost"
		class="h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
		onclick={clearAllFilters}>{clearAllLabel}</Button
	>
</div>
