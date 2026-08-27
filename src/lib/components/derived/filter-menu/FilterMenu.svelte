<script lang="ts">
	import { tick } from 'svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ListFilterPlusIcon from '@lucide/svelte/icons/list-filter-plus';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { cn } from '$lib/utils.js';
	import ActiveFilterPills from './ActiveFilterPills.svelte';
	import { normalizeActiveFilters, type ActiveFilterItem } from './active_filters.js';
	import type { FilterDefinition, FilterFacetGroup } from './filter_menu_types.js';

	interface FilterMenuProps {
		definitions: readonly FilterDefinition[];
		facets?: readonly FilterFacetGroup[];
		activeFilters?: readonly ActiveFilterItem[];
		showActivePills?: boolean;
		alwaysShowClearAllInMenu?: boolean;
		triggerLabel: string;
		menuHeading: string;
		clearAllLabel: string;
		onclearall: () => void;
		removeFilterLabel: (label: string) => string;
		activeCountLabel: (count: number) => string;
		align?: 'start' | 'center' | 'end';
		triggerElement?: HTMLButtonElement | null;
		triggerClass?: string;
		class?: string;
	}

	let {
		definitions,
		facets = [],
		activeFilters: suppliedActiveFilters,
		showActivePills = true,
		alwaysShowClearAllInMenu = false,
		triggerLabel,
		menuHeading,
		clearAllLabel,
		onclearall,
		removeFilterLabel,
		activeCountLabel,
		align = 'start',
		triggerElement = $bindable(null),
		triggerClass,
		class: className,
	}: FilterMenuProps = $props();

	const activeFilters = $derived(
		suppliedActiveFilters ?? normalizeActiveFilters(definitions, facets),
	);

	async function clearAllFilters() {
		onclearall();
		await tick();
		triggerElement?.focus();
	}
</script>

<div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					bind:ref={triggerElement}
					size="md"
					intent="outline"
					class={cn('min-w-0 max-w-full', triggerClass)}
					aria-label={activeFilters.length > 0
						? `${triggerLabel}: ${activeCountLabel(activeFilters.length)}`
						: triggerLabel}
				>
					<ListFilterPlusIcon
						class="text-muted-foreground"
						data-icon="inline-start"
						data-toolbar-icon="filter"
					/>
					<span class="min-w-0 truncate">{triggerLabel}</span>
					{#if activeFilters.length > 0}
						<span
							class="grid min-w-4.25 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10.5px] leading-4 text-primary-foreground"
							aria-hidden="true"
						>
							{activeFilters.length}
						</span>
					{/if}
					<ChevronDownIcon class="size-4 shrink-0 text-muted-foreground" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>

		<DropdownMenu.Content
			{align}
			class="max-h-[min(32rem,calc(100dvh-2rem))] w-[min(16rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto"
		>
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>{menuHeading}</DropdownMenu.GroupHeading>
				{#each definitions as definition (definition.id)}
					<DropdownMenu.CheckboxItem
						class="min-w-0 whitespace-normal break-words"
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
							class="min-w-0 whitespace-normal break-words"
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
				<DropdownMenu.Item
					class={cn(
						'whitespace-normal break-words',
						!alwaysShowClearAllInMenu && 'sm:hidden',
					)}
					onclick={clearAllFilters}
				>
					{clearAllLabel}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if showActivePills && activeFilters.length > 0}
		<ActiveFilterPills
			class="hidden sm:flex"
			items={activeFilters}
			{clearAllLabel}
			{onclearall}
			{removeFilterLabel}
			{triggerElement}
		/>
	{/if}
</div>
