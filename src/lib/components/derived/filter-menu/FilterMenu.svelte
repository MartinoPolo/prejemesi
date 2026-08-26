<script lang="ts">
	import { tick } from 'svelte';
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import { cn } from '$lib/utils.js';
	import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

	interface FilterMenuProps {
		definitions: readonly FilterDefinition[];
		facets?: readonly FilterFacetGroup[];
		triggerLabel: string;
		menuHeading: string;
		clearAllLabel: string;
		onclearall: () => void;
		removeFilterLabel: (label: string) => string;
		activeCountLabel: (count: number) => string;
		align?: 'start' | 'center' | 'end';
		class?: string;
	}

	interface ActiveFilterItem {
		id: string;
		label: string;
		onremove: () => void;
	}

	let {
		definitions,
		facets = [],
		triggerLabel,
		menuHeading,
		clearAllLabel,
		onclearall,
		removeFilterLabel,
		activeCountLabel,
		align = 'start',
		class: className,
	}: FilterMenuProps = $props();

	let filterTriggerElement = $state<HTMLButtonElement | null>(null);
	let pillRemoveButtons = $state<Record<string, HTMLButtonElement | undefined>>({});

	const activeFilters = $derived<ActiveFilterItem[]>([
		...definitions
			.filter((definition) => definition.checked)
			.map((definition) => ({
				id: definition.id,
				label: definition.activeLabel ?? definition.menuLabel,
				onremove: () => definition.onchange(false),
			})),
		...facets.flatMap((facet) =>
			facet.options
				.filter((option) => option.checked)
				.map((option) => ({
					id: `${facet.id}:${option.value}`,
					label: option.label,
					onremove: () => option.onchange(false),
				})),
		),
	]);

	async function clearAllFilters() {
		onclearall();
		await tick();
		filterTriggerElement?.focus();
	}

	async function removeActiveFilter(item: ActiveFilterItem) {
		const activeDefinitionIndex = activeFilters.findIndex(({ id }) => id === item.id);
		const nextActiveDefinition = activeFilters.at(activeDefinitionIndex + 1);

		item.onremove();
		await tick();
		(nextActiveDefinition
			? pillRemoveButtons[nextActiveDefinition.id]
			: filterTriggerElement
		)?.focus();
	}
</script>

<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					bind:ref={filterTriggerElement}
					size="md"
					intent="outline"
					aria-label={activeFilters.length > 0
						? `${triggerLabel}: ${activeCountLabel(activeFilters.length)}`
						: triggerLabel}
				>
					<ListFilterIcon data-icon="inline-start" />
					<span>{triggerLabel}</span>
					{#if activeFilters.length > 0}
						<span
							class="grid min-w-4.25 place-items-center rounded-full bg-primary px-1 text-[10.5px] leading-4 text-primary-foreground"
							aria-hidden="true"
						>
							{activeFilters.length}
						</span>
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>

		<DropdownMenu.Content {align} class="w-64">
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>{menuHeading}</DropdownMenu.GroupHeading>
				{#each definitions as definition (definition.id)}
					<DropdownMenu.CheckboxItem
						bind:checked={
							() => definition.checked, (checked) => definition.onchange(checked)
						}
						closeOnSelect={false}
					>
						{definition.menuLabel}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Group>

			{#each facets.filter((facet) => facet.options.length > 0) as facet (facet.id)}
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading>{facet.label}</DropdownMenu.GroupHeading>
					{#each facet.options as option (option.value)}
						<DropdownMenu.CheckboxItem
							bind:checked={
								() => option.checked, (checked) => option.onchange(checked)
							}
							closeOnSelect={false}
						>
							{option.label}
						</DropdownMenu.CheckboxItem>
					{/each}
				</DropdownMenu.Group>
			{/each}

			{#if activeFilters.length > 0}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="sm:hidden" onclick={clearAllFilters}>
					{clearAllLabel}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if activeFilters.length > 0}
		<div class="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex" data-filter-pills>
			{#each activeFilters as item (item.id)}
				<SimpleTooltip text={item.label}>
					<span
						class="inline-flex h-(--size-control-sm) max-w-50 items-center gap-1 rounded-full border-2 border-ink bg-primary py-0 pr-0.5 pl-2.5 text-(length:--text-sm) font-semibold text-primary-foreground"
					>
						<span class="truncate">{item.label}</span>
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
			<Button size="sm" intent="ghost" onclick={clearAllFilters}>{clearAllLabel}</Button>
		</div>
	{/if}
</div>
