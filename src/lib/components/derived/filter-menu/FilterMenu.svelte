<script lang="ts">
	import { tick } from 'svelte';
	import ListFilterIcon from '@lucide/svelte/icons/list-filter';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import SimpleTooltip from '$lib/components/base/tooltip/SimpleTooltip.svelte';
	import { cn } from '$lib/utils.js';
	import type { FilterDefinition } from './filter_menu_types.js';

	interface FilterMenuProps {
		definitions: readonly FilterDefinition[];
		triggerLabel: string;
		menuHeading: string;
		clearAllLabel: string;
		onclearall: () => void;
		removeFilterLabel: (label: string) => string;
		activeCountLabel: (count: number) => string;
		align?: 'start' | 'center' | 'end';
		class?: string;
	}

	let {
		definitions,
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
	const activeDefinitions = $derived(definitions.filter((definition) => definition.checked));

	async function clearAllFilters() {
		onclearall();
		await tick();
		filterTriggerElement?.focus();
	}

	async function removeActiveFilter(definition: FilterDefinition) {
		const activeDefinitionIndex = activeDefinitions.findIndex(({ id }) => id === definition.id);
		const nextActiveDefinition = activeDefinitions.at(activeDefinitionIndex + 1);

		definition.onchange(false);
		await tick();
		(nextActiveDefinition
			? pillRemoveButtons[nextActiveDefinition.id]
			: filterTriggerElement
		)?.focus();
	}

	function activeLabel(definition: FilterDefinition) {
		return definition.activeLabel ?? definition.menuLabel;
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
					aria-label={activeDefinitions.length > 0
						? `${triggerLabel}: ${activeCountLabel(activeDefinitions.length)}`
						: triggerLabel}
				>
					<ListFilterIcon />
					<span>{triggerLabel}</span>
					{#if activeDefinitions.length > 0}
						<span
							class="grid min-w-4.25 place-items-center rounded-full bg-primary px-1 text-[10.5px] leading-4 text-primary-foreground"
							aria-hidden="true"
						>
							{activeDefinitions.length}
						</span>
					{/if}
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>

		<DropdownMenu.Content {align} class="w-56">
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

			{#if activeDefinitions.length > 0}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="sm:hidden" onclick={clearAllFilters}>
					{clearAllLabel}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if activeDefinitions.length > 0}
		<div class="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex" data-filter-pills>
			{#each activeDefinitions as definition (definition.id)}
				<SimpleTooltip text={activeLabel(definition)}>
					<span
						class="inline-flex h-(--size-control-sm) max-w-50 items-center gap-1 rounded-full border-2 border-ink bg-primary py-0 pr-0.5 pl-2.5 text-(length:--text-sm) font-semibold text-primary-foreground"
					>
						<span class="truncate">{activeLabel(definition)}</span>
						<button
							bind:this={pillRemoveButtons[definition.id]}
							type="button"
							class="grid size-6 shrink-0 place-items-center rounded-full text-current hover:bg-[color-mix(in_oklab,currentColor_24%,transparent)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-current"
							aria-label={removeFilterLabel(activeLabel(definition))}
							onclick={() => removeActiveFilter(definition)}
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
