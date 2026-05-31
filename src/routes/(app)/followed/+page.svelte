<script lang="ts">
	import PageHeader from '$lib/components/blocks/page-header/PageHeader.svelte';
	import DashboardToolbar from '$lib/components/blocks/dashboard/DashboardToolbar.svelte';
	import WishlistCardGrid from '$lib/components/blocks/dashboard/WishlistCardGrid.svelte';
	import WishlistListView from '$lib/components/blocks/dashboard/WishlistListView.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import { getFollowedWishlists } from '$lib/modules/wishlists/wishlists.remote.js';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard-types.js';
	import type { FollowedWishlist } from '$lib/modules/wishlists/dashboard-types.js';

	let sortValue = $state<SortOption>('lastActivity');
	let viewMode = $state<ViewMode>('grid');
	let showArchived = $state(false);
	let showUnfollowed = $state(false);

	const wishlists = getFollowedWishlists();

	const filteredWishlists = $derived.by(() => {
		const all = wishlists.current ?? [];
		let filtered = showArchived ? all : all.filter((w) => w.status !== 'archived');
		filtered = showUnfollowed ? filtered : filtered.filter((w) => w.unfollowedAt === null);
		return sortFollowedWishlists(filtered, sortValue);
	});

	function sortFollowedWishlists(
		items: FollowedWishlist[],
		sort: SortOption,
	): FollowedWishlist[] {
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

<PageHeader title="Sledované">
	{#snippet toolbar()}
		<DashboardToolbar
			bind:sortValue
			bind:viewMode
			bind:showArchived
			showUnfollowed
			bind:unfollowedValue={showUnfollowed}
		/>
	{/snippet}
</PageHeader>

{#if wishlists.loading}
	<p class="py-12 text-center text-muted-foreground">Načítání...</p>
{:else if filteredWishlists.length === 0}
	<EmptyState
		emoji="👀"
		title="Nesledujete žádné seznamy"
		description="Otevřete sdílený odkaz na seznam přání a začněte ho sledovat."
	/>
{:else if viewMode === 'grid'}
	<WishlistCardGrid>
		{#each filteredWishlists as wishlistItem (wishlistItem.id)}
			<WishlistCard
				wishlist={wishlistItem}
				ownerName={wishlistItem.ownerName}
				availableGifts={wishlistItem.availableGifts}
				myReservations={wishlistItem.myReservations}
			/>
		{/each}
	</WishlistCardGrid>
{:else}
	<WishlistListView
		items={filteredWishlists.map((w) => ({
			wishlist: w,
			ownerName: w.ownerName,
			giftCount: w.availableGifts,
		}))}
	/>
{/if}
