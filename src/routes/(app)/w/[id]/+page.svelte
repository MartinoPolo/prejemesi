<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import WishlistHeader from '$lib/components/blocks/gift/WishlistHeader.svelte';
	import GiftSortFilter from '$lib/components/blocks/gift/GiftSortFilter.svelte';
	import GiftViewSwitcher from '$lib/components/blocks/gift/GiftViewSwitcher.svelte';
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftCompactRow from '$lib/components/blocks/gift/GiftCompactRow.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { untrack } from 'svelte';
	import type { GiftFilters, GiftSortOption } from '$lib/modules/gifts/types.js';

	let { data } = $props();

	const wishlist = $derived(data.wishlist);
	const role = $derived(data.role);
	const isArchived = $derived(wishlist.status === 'archived');
	const isOwner = $derived(role === 'owner');
	const isOwnerOrModerator = $derived(role === 'owner' || role === 'moderator');

	const giftsContext = untrack(() =>
		setGiftsContext(data.gifts, data.role, data.wishlist.status === 'archived'),
	);

	const displayedGifts = $derived(giftsContext.sortedAndFilteredGifts.current);
	const viewMode = $derived(giftsContext.viewMode.current);
	const totalCount = $derived(giftsContext.giftCount.current);
	const hasActiveFilters = $derived(giftsContext.hasActiveFilters.current);
	const isFilteredEmpty = $derived(displayedGifts.length === 0 && totalCount > 0);
	const isEmpty = $derived(totalCount === 0);

	function handleViewModeChange(mode: typeof viewMode) {
		giftsContext.viewMode.current = mode;
	}

	function handleSortChange(sort: GiftSortOption) {
		giftsContext.sortOption.current = sort;
	}

	function handleFilterChange(filters: GiftFilters) {
		giftsContext.filters.current = filters;
	}

	function clearFilters() {
		giftsContext.filters.current = { availableOnly: false, withLinkOnly: false };
	}
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
	<!-- Wishlist Header -->
	<WishlistHeader
		title={wishlist.title}
		ownerName={wishlist.ownerName}
		description={wishlist.description}
		bannerImageKey={wishlist.bannerImageKey}
		eventDate={wishlist.eventDate}
		status={wishlist.status}
		{role}
		giftCount={totalCount}
	/>

	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-3">
		<GiftViewSwitcher value={viewMode} onchange={handleViewModeChange} />

		<GiftSortFilter
			sortValue={giftsContext.sortOption.current}
			filters={giftsContext.filters.current}
			{hasActiveFilters}
			onsortchange={handleSortChange}
			onfilterchange={handleFilterChange}
		/>

		<div class="ml-auto flex items-center gap-2">
			{#if isOwnerOrModerator && !isArchived}
				<Button size="sm" aria-label="Pridat prani">
					<PlusIcon data-icon="inline-start" />
					Pridat prani
				</Button>
			{/if}
		</div>
	</div>

	<!-- Gift Display -->
	{#if isEmpty}
		<!-- Empty state: no gifts at all -->
		{#if isArchived}
			<EmptyState
				emoji="🗄️"
				title="Seznam byl archivovan"
				description="Tento seznam byl archivovan a je prazdny."
			/>
		{:else if isOwner}
			<EmptyState
				emoji="🎁"
				title="Zatim tu nic neni"
				description="Pridej sva prvni prani a pak seznam sdilej."
			>
				{#snippet actions()}
					<Button aria-label="Pridat prvni prani">
						<PlusIcon data-icon="inline-start" />
						Pridat prvni prani
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState
				emoji="🎁"
				title="Tento seznam zatim nema zadne darky"
				description="Vlastnik jeste nepridal zadna prani."
			/>
		{/if}
	{:else if isFilteredEmpty}
		<!-- Empty state: filters returned nothing -->
		<EmptyState
			emoji="🔍"
			title="Zadna prani neodpovidaji filtrum"
			description="Zkuste zmenit nebo zrusit filtry."
		>
			{#snippet actions()}
				<Button variant="outline" onclick={clearFilters}>Zrusit filtry</Button>
			{/snippet}
		</EmptyState>
	{:else if viewMode === 'card'}
		<!-- Card Grid -->
		<div class="grid gap-5" style:grid-template-columns="repeat(auto-fill, minmax(280px, 1fr))">
			{#each displayedGifts as giftItem (giftItem.id)}
				<GiftCard gift={giftItem} {role} {isArchived} />
			{/each}
		</div>
	{:else if viewMode === 'list'}
		<!-- List View -->
		<div class="flex flex-col">
			{#each displayedGifts as giftItem (giftItem.id)}
				<GiftListItem gift={giftItem} {role} {isArchived} />
			{/each}
		</div>
	{:else}
		<!-- Compact Table View -->
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b-2 border-border">
						<th
							class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Nazev
						</th>
						<th
							class="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Odkaz
						</th>
						<th
							class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							Cena
						</th>
						{#if !isOwner}
							<th
								class="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
							>
								&#9825;
							</th>
							<th
								class="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
							>
								Akce
							</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each displayedGifts as giftItem (giftItem.id)}
						<GiftCompactRow gift={giftItem} {role} {isArchived} />
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
