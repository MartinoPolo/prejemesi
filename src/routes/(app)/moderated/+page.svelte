<script lang="ts">
	import PageHeader from '$lib/components/blocks/page-header/PageHeader.svelte';
	import DashboardToolbar from '$lib/components/blocks/dashboard/DashboardToolbar.svelte';
	import WishlistCardGrid from '$lib/components/blocks/dashboard/WishlistCardGrid.svelte';
	import WishlistListView from '$lib/components/blocks/dashboard/WishlistListView.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import { getModeratedWishlists } from '$lib/modules/wishlists/wishlists.remote.js';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard-types.js';
	import type { ModeratedWishlist } from '$lib/modules/wishlists/dashboard-types.js';

	let sortValue = $state<SortOption>('lastActivity');
	let viewMode = $state<ViewMode>('grid');
	let showArchived = $state(false);

	let wishlistData = $state<ModeratedWishlist[]>([]);
	let isLoading = $state(true);

	async function fetchWishlists() {
		isLoading = true;
		try {
			wishlistData = await getModeratedWishlists();
		} catch {
			wishlistData = [];
		} finally {
			isLoading = false;
		}
	}

	fetchWishlists();

	const filteredWishlists = $derived.by(() => {
		const filtered = showArchived
			? wishlistData
			: wishlistData.filter((w: ModeratedWishlist) => w.status !== 'archived');
		return sortModeratedWishlists(filtered, sortValue);
	});

	function sortModeratedWishlists(
		items: ModeratedWishlist[],
		sort: SortOption,
	): ModeratedWishlist[] {
		const sorted = [...items];
		switch (sort) {
			case 'lastActivity':
				return sorted.sort(
					(a, b) =>
						new Date(b.updatedAt ?? b.createdAt).getTime() -
						new Date(a.updatedAt ?? a.createdAt).getTime(),
				);
			case 'alphabetical':
				return sorted.sort((a, b) => a.title.localeCompare(b.title, 'cs'));
			case 'dateCreated':
				return sorted.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				);
			case 'eventDate':
				return sorted.sort((a, b) => {
					if (a.eventDate === null && b.eventDate === null) {
						return 0;
					}
					if (a.eventDate === null) {
						return 1;
					}
					if (b.eventDate === null) {
						return -1;
					}
					return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
				});
		}
	}
</script>

<PageHeader title="Spravované">
	{#snippet toolbar()}
		<DashboardToolbar bind:sortValue bind:viewMode bind:showArchived />
	{/snippet}
</PageHeader>

{#if isLoading}
	<p class="py-12 text-center text-muted-foreground">Načítání...</p>
{:else if filteredWishlists.length === 0}
	<EmptyState
		emoji="🛡️"
		title="Nespravujete žádné seznamy"
		description="Až vás někdo přidá jako správce svého seznamu, zobrazí se zde."
	/>
{:else if viewMode === 'grid'}
	<WishlistCardGrid>
		{#each filteredWishlists as wishlistItem (wishlistItem.id)}
			<WishlistCard
				wishlist={wishlistItem}
				ownerName={wishlistItem.ownerName}
				reservationProgress={{
					reserved: wishlistItem.reservedGifts,
					total: wishlistItem.totalGifts,
				}}
			/>
		{/each}
	</WishlistCardGrid>
{:else}
	<WishlistListView
		items={filteredWishlists.map((w) => ({
			wishlist: w,
			ownerName: w.ownerName,
			giftCount: w.totalGifts,
			reservedCount: w.reservedGifts,
		}))}
	/>
{/if}
