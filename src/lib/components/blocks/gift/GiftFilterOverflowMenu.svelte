<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import type { GiftFilters } from '$lib/modules/gifts/types.js';
	import { cn } from '$lib/utils.js';

	interface GiftFilterOverflowMenuProps {
		filters: GiftFilters;
		/** Whether the viewer can have likes (authenticated non-recipient) — gates „Oblíbené". */
		showLikedFilter: boolean;
		onfilterchange: (filters: GiftFilters) => void;
	}

	let { filters, showLikedFilter, onfilterchange }: GiftFilterOverflowMenuProps = $props();

	const hasActiveMenuFilter = $derived(filters.withLinkOnly || filters.likedOnly);

	function toggleWithLinkOnly() {
		onfilterchange({ ...filters, withLinkOnly: !filters.withLinkOnly });
	}

	function toggleLikedOnly() {
		onfilterchange({ ...filters, likedOnly: !filters.likedOnly });
	}
</script>

<!-- Small overflow menu for the rare filters („s odkazem", „oblíbené") per issue #101 / #102 REQ-15;
     „Pouze dostupné" was promoted to a standalone toolbar chip. -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="icon"
				intent="outline"
				class={cn('relative', hasActiveMenuFilter && 'border-primary')}
				aria-label={m.gift_filter()}
			>
				<FilterIcon />
				{#if hasActiveMenuFilter}
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
				<DropdownMenu.GroupHeading>{m.gift_filter()}</DropdownMenu.GroupHeading>
				<DropdownMenu.CheckboxItem
					checked={filters.withLinkOnly}
					onclick={toggleWithLinkOnly}
				>
					{m.gift_filter_with_link()}
				</DropdownMenu.CheckboxItem>
				{#if showLikedFilter}
					<DropdownMenu.CheckboxItem
						checked={filters.likedOnly}
						onclick={toggleLikedOnly}
					>
						{m.gift_filter_liked()}
					</DropdownMenu.CheckboxItem>
				{/if}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
