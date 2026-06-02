<script lang="ts">
	import PageHeader from '$lib/components/blocks/page-header/PageHeader.svelte';
	import DashboardToolbar from '$lib/components/blocks/dashboard/DashboardToolbar.svelte';
	import WishlistCardGrid from '$lib/components/blocks/dashboard/WishlistCardGrid.svelte';
	import WishlistListView from '$lib/components/blocks/dashboard/WishlistListView.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import {
		getFollowedWishlists,
		unfollowWishlist,
		refollowWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard_types.js';
	import type { FollowedWishlist } from '$lib/modules/wishlists/dashboard_types.js';

	let sortValue = $state<SortOption>('lastActivity');
	let viewMode = $state<ViewMode>('grid');
	let showArchived = $state(false);
	let showUnfollowed = $state(false);

	let wishlistData = $state.raw<FollowedWishlist[]>([]);
	let isLoading = $state(true);

	async function fetchWishlists(refresh = false) {
		isLoading = true;
		try {
			if (refresh) {
				await getFollowedWishlists().refresh();
			}
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
			await fetchWishlists(true);
			toastSuccess(m.toast_unfollowed());
		} catch {
			toastError(m.toast_unfollow_error());
		}
	}

	async function handleRefollow(wishlistId: string) {
		try {
			await refollowWishlist(wishlistId);
			await fetchWishlists(true);
			toastSuccess(m.toast_refollowed());
		} catch {
			toastError(m.toast_refollow_error());
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

<PageHeader title={m.followed_title()}>
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
	<p class="py-12 text-center text-muted-foreground">{m.followed_loading()}</p>
{:else if filteredWishlists.length === 0}
	<EmptyState
		emoji="👀"
		title={m.followed_empty_title()}
		description={m.followed_empty_description()}
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
							intent="outline"
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
							intent="ghost"
							onclick={(e) => {
								e.preventDefault();
								handleUnfollow(wishlistItem.id);
							}}
						>
							{m.wishlist_detail_unfollow()}
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
