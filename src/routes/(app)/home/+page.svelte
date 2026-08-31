<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Carousel from '$lib/components/base/carousel/index.js';
	import HomeShelf from '$lib/components/blocks/dashboard/HomeShelf.svelte';
	import WishlistCard from '$lib/components/blocks/dashboard/WishlistCard.svelte';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import { CreateWishlistModal } from '$lib/components/blocks/wishlist/index.js';
	import { ImportWizard, WIZARD_MODE } from '$lib/components/blocks/import/index.js';
	import {
		HOME_OVERVIEW_DEPENDENCY,
		type RecentHomeItem,
		type OwnHomeItem,
		type ModeratedHomeItem,
		type FollowedHomeItem,
	} from '$lib/modules/wishlists/home_overview_types.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const overview = $derived(data.overview);

	// Every slide keeps the same width so the peek geometry stays consistent across rows.
	const SLIDE_CLASS = 'basis-[80vw] sm:basis-[320px]';

	const followedHref = localizeInternalHref(resolve('/(app)/followed'));
	const moderatedHref = localizeInternalHref(resolve('/(app)/moderated'));
	const ownHref = localizeInternalHref(resolve('/(app)/my-lists'));

	const isEmpty = $derived(
		overview.own.total === 0 && overview.moderated.total === 0 && overview.followed.total === 0,
	);

	let isCreateModalOpen = $state(false);
	let isImportWizardOpen = $state(false);
</script>

{#snippet ownCard(item: OwnHomeItem)}
	<WishlistCard wishlist={item} giftCount={item.totalGifts} />
{/snippet}

{#snippet moderatedCard(item: ModeratedHomeItem)}
	<WishlistCard
		wishlist={item}
		recipientDisplayName={item.recipientDisplayName}
		reservationProgress={{ reserved: item.reservedGifts, total: item.totalGifts }}
	/>
{/snippet}

{#snippet followedCard(item: FollowedHomeItem)}
	<WishlistCard
		wishlist={item}
		recipientDisplayName={item.recipientDisplayName}
		availableGifts={item.availableGifts}
		myReservations={item.myReservations}
	/>
{/snippet}

{#snippet recentCard(item: RecentHomeItem)}
	{#if item.role === 'own'}
		{@render ownCard(item)}
	{:else if item.role === 'moderated'}
		{@render moderatedCard(item)}
	{:else}
		{@render followedCard(item)}
	{/if}
{/snippet}

<h1 class="page-title">{m.home_title()}</h1>

{#if isEmpty}
	<EmptyState emoji="📝" title={m.home_hero_title()} description={m.home_hero_description()}>
		{#snippet actions()}
			<Button onclick={() => (isCreateModalOpen = true)}>
				<PlusIcon data-icon="inline-start" />
				{m.dashboard_create_list()}
			</Button>
			<Button intent="outline" onclick={() => (isImportWizardOpen = true)}>
				<FileUpIcon data-icon="inline-start" />
				{m.home_hero_import()}
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	{#if overview.recent.length > 0}
		<HomeShelf title={m.nav_recent()} visibleCount={overview.recent.length}>
			{#snippet icon()}🕐{/snippet}
			{#each overview.recent as item (item.role + item.id)}
				<Carousel.Item class={SLIDE_CLASS}>
					{@render recentCard(item)}
				</Carousel.Item>
			{/each}
		</HomeShelf>
	{/if}

	{#if overview.followed.total > 0}
		<HomeShelf
			title={m.nav_followed()}
			viewAllHref={followedHref}
			total={overview.followed.total}
			visibleCount={overview.followed.items.length}
		>
			{#each overview.followed.items as item (item.id)}
				<Carousel.Item class={SLIDE_CLASS}>
					{@render followedCard(item)}
				</Carousel.Item>
			{/each}
		</HomeShelf>
	{/if}

	{#if overview.moderated.total > 0}
		<HomeShelf
			title={m.nav_moderated()}
			viewAllHref={moderatedHref}
			total={overview.moderated.total}
			visibleCount={overview.moderated.items.length}
		>
			{#each overview.moderated.items as item (item.id)}
				<Carousel.Item class={SLIDE_CLASS}>
					{@render moderatedCard(item)}
				</Carousel.Item>
			{/each}
		</HomeShelf>
	{/if}

	{#if overview.own.total > 0}
		<HomeShelf
			title={m.nav_my_lists()}
			viewAllHref={ownHref}
			total={overview.own.total}
			visibleCount={overview.own.items.length}
		>
			{#each overview.own.items as item (item.id)}
				<Carousel.Item class={SLIDE_CLASS}>
					{@render ownCard(item)}
				</Carousel.Item>
			{/each}
		</HomeShelf>
	{/if}
{/if}

<CreateWishlistModal bind:open={isCreateModalOpen} />
<ImportWizard
	bind:open={isImportWizardOpen}
	mode={WIZARD_MODE.newList}
	onsuccess={() => void invalidate(HOME_OVERVIEW_DEPENDENCY)}
/>

<style>
	.page-title {
		font-family: var(--font-heading);
		font-size: var(--text-3xl);
		font-weight: var(--weight-semibold);
		margin-bottom: var(--space-6);
	}
</style>
