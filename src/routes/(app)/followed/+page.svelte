<script lang="ts">
	import PageHeader from '$lib/components/blocks/page-header/PageHeader.svelte';
	import DashboardToolbar from '$lib/components/blocks/dashboard/DashboardToolbar.svelte';
	import WishlistCardGrid from '$lib/components/blocks/dashboard/WishlistCardGrid.svelte';
	import WishlistListView from '$lib/components/blocks/dashboard/WishlistListView.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		getFollowedWishlists,
		unfollowWishlist,
		refollowWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { toast } from 'svelte-sonner';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard-types.js';
	import type { FollowedWishlist } from '$lib/modules/wishlists/dashboard-types.js';

	let sortValue = $state<SortOption>('lastActivity');
	let viewMode = $state<ViewMode>('grid');
	let showArchived = $state(false);
	let showUnfollowed = $state(false);

	let wishlistData = $state<FollowedWishlist[]>([]);
	let isLoading = $state(true);

	async function fetchWishlists() {
		isLoading = true;
		try {
			wishlistData = await getFollowedWishlists();
		} catch {
			wishlistData = [];
		} finally {
			isLoading = false;
		}
	}

	fetchWishlists();

	const filteredWishlists = $derived.by(() => {
		let filtered = showArchived
			? wishlistData
			: wishlistData.filter((w: FollowedWishlist) => w.status !== 'archived');
		filtered = showUnfollowed
			? filtered
			: filtered.filter((w: FollowedWishlist) => w.unfollowedAt === null);
		return sortFollowedWishlists(filtered, sortValue);
	});

	async function handleUnfollow(wishlistId: string) {
		try {
			await unfollowWishlist(wishlistId);
			await fetchWishlists();
			toast.success('Seznam jste prestali sledovat');
		} catch {
			toast.error('Nepodarilo se prestat sledovat');
		}
	}

	async function handleRefollow(wishlistId: string) {
		try {
			await refollowWishlist(wishlistId);
			await fetchWishlists();
			toast.success('Seznam znovu sledujete');
		} catch {
			toast.error('Nepodarilo se znovu sledovat');
		}
	}

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

{#if isLoading}
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
			>
				{#snippet actions()}
					{#if wishlistItem.unfollowedAt !== null}
						<Button
							size="sm"
							variant="outline"
							onclick={(e) => {
								e.preventDefault();
								handleRefollow(wishlistItem.id);
							}}
						>
							Znovu sledovat
						</Button>
					{:else}
						<Button
							size="sm"
							variant="ghost"
							onclick={(e) => {
								e.preventDefault();
								handleUnfollow(wishlistItem.id);
							}}
						>
							Prestat sledovat
						</Button>
					{/if}
				{/snippet}
			</WishlistCard>
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
