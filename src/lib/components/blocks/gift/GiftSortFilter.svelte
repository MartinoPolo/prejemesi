<script lang="ts">
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import CheckIcon from '@lucide/svelte/icons/check';
	import {
		GIFT_SORT_OPTIONS,
		type GiftSortOption,
		type GiftFilters,
	} from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

	interface GiftSortFilterProps {
		sortValue: GiftSortOption;
		filters: GiftFilters;
		hasActiveFilters: boolean;
		onsortchange: (sort: GiftSortOption) => void;
		onfilterchange: (filters: GiftFilters) => void;
	}

	let {
		sortValue,
		filters,
		hasActiveFilters,
		onsortchange,
		onfilterchange,
	}: GiftSortFilterProps = $props();

	const SORT_LABELS = {
		ownerOrder: 'Poradi vlastnika',
		priority: 'Priorita',
		priceAsc: 'Cena (vzestupne)',
		priceDesc: 'Cena (sestupne)',
		name: 'Nazev',
		dateAdded: 'Datum pridani',
	} as const satisfies Record<GiftSortOption, string>;

	const SORT_KEYS = Object.keys(GIFT_SORT_OPTIONS) as GiftSortOption[];

	function handleSortSelect(option: GiftSortOption) {
		onsortchange(option);
	}

	function toggleAvailableOnly() {
		onfilterchange({ ...filters, availableOnly: !filters.availableOnly });
	}

	function toggleWithLinkOnly() {
		onfilterchange({ ...filters, withLinkOnly: !filters.withLinkOnly });
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="icon"
				intent="outline"
				class={cn('relative size-8', hasActiveFilters && 'border-primary')}
				aria-label="Radit a filtrovat"
			>
				<FilterIcon class="size-4" />
				{#if hasActiveFilters}
					<span
						class="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary"
						aria-hidden="true"
					></span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Portal>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Radit podle</DropdownMenu.GroupHeading>
				{#each SORT_KEYS as option (option)}
					<DropdownMenu.Item onclick={() => handleSortSelect(option)}>
						<span class="flex w-full items-center gap-2">
							<span class={cn('size-4', sortValue !== option && 'invisible')}>
								{#if sortValue === option}
									<CheckIcon class="size-4" />
								{/if}
							</span>
							{SORT_LABELS[option]}
						</span>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>

			<DropdownMenu.Separator />

			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Filtrovat</DropdownMenu.GroupHeading>
				<DropdownMenu.CheckboxItem
					checked={filters.availableOnly}
					onclick={toggleAvailableOnly}
				>
					Pouze dostupne
				</DropdownMenu.CheckboxItem>
				<DropdownMenu.CheckboxItem
					checked={filters.withLinkOnly}
					onclick={toggleWithLinkOnly}
				>
					S odkazem
				</DropdownMenu.CheckboxItem>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
