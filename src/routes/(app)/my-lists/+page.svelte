<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/blocks/page-header/PageHeader.svelte';
	import DashboardToolbar from '$lib/components/blocks/dashboard/DashboardToolbar.svelte';
	import WishlistCardGrid from '$lib/components/blocks/dashboard/WishlistCardGrid.svelte';
	import WishlistListView from '$lib/components/blocks/dashboard/WishlistListView.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import { CreateWishlistModal } from '$lib/components/blocks/wishlist/index.js';
	import { ImportWizard, WIZARD_MODE } from '$lib/components/blocks/import/index.js';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import { getMyWishlists } from '$lib/modules/wishlists/wishlists.remote.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { SortOption, ViewMode } from '$lib/modules/wishlists/dashboard_types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';

	let sortValue = $state<SortOption>('lastActivity');
	let viewMode = $state<ViewMode>('grid');
	let showArchived = $state(false);
	let isCreateModalOpen = $state(false);
	let isImportWizardOpen = $state(false);

	const allWishlists = await getMyWishlists();

	const filteredWishlists = $derived.by(() => {
		const filtered = showArchived
			? allWishlists
			: allWishlists.filter((w) => w.status !== 'archived');
		return sortWishlists(filtered, sortValue);
	});

	function sortWishlists<T extends Wishlist>(items: T[], sort: SortOption): T[] {
		const sorted = [...items];
		switch (sort) {
			case 'lastActivity':
				return sorted.sort(
					(a, b) =>
						new Date(b.updatedAt ?? b.createdAt).getTime() -
						new Date(a.updatedAt ?? a.createdAt).getTime(),
				);
			case 'alphabetical':
				return sorted.sort((a, b) => a.title.localeCompare(b.title, getLocale()));
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

<PageHeader title={m.dashboard_my_lists_title()}>
	{#snippet toolbar()}
		<DashboardToolbar bind:sortValue bind:viewMode bind:showArchived />
	{/snippet}
</PageHeader>

{#if filteredWishlists.length === 0}
	<EmptyState
		emoji="📝"
		title={m.dashboard_empty_title()}
		description={m.dashboard_empty_description()}
	>
		{#snippet actions()}
			<Button onclick={() => (isCreateModalOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				{m.dashboard_create_list()}
			</Button>
			<Button intent="outline" onclick={() => (isImportWizardOpen = true)}>
				<FileUpIcon data-icon="inline-start" />
				{m.import_wizard_title()}
			</Button>
		{/snippet}
	</EmptyState>
{:else if viewMode === 'grid'}
	<WishlistCardGrid>
		{#each filteredWishlists as wishlistItem (wishlistItem.id)}
			<WishlistCard wishlist={wishlistItem} giftCount={wishlistItem.totalGifts} />
		{/each}
	</WishlistCardGrid>
{:else}
	<WishlistListView
		items={filteredWishlists.map((w) => ({ wishlist: w, giftCount: w.totalGifts }))}
	/>
{/if}

<CreateWishlistModal bind:open={isCreateModalOpen} />
<ImportWizard bind:open={isImportWizardOpen} mode={WIZARD_MODE.newList} />
