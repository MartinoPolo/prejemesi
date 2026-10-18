<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		ChangeReview,
		ChangeReviewHeader,
		ChangeReviewSkeleton,
	} from '$lib/components/blocks/change-proposals/index.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import {
		applyChangeProposal,
		discardChangeProposal,
		getChangeProposal,
		undoChangeProposal,
	} from '$lib/modules/change_proposals/index.js';
	import { getGiftCategories } from '$lib/modules/gift-categories/gift_category_queries.remote.js';
	import {
		getGiftsByWishlistShortId,
		getPriorityLevels,
	} from '$lib/modules/gifts/gifts.remote.js';
	import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';

	const shortId = $derived(page.params.id!);
	const proposalId = $derived(page.params.proposalId!);

	// The awaited wishlist feeds <svelte:head> and the header during SSR; the reactive query shares
	// its cache entry, so hydration does not fetch it again and apply/undo refreshes flow in.
	// svelte-ignore state_referenced_locally
	const initialWishlist = await getWishlistByShortId(shortId);
	const wishlistQuery = $derived(getWishlistByShortId(shortId));
	const wishlist = $derived(wishlistQuery.current ?? initialWishlist);
	const canManage = $derived(canManageWishlist(wishlist.role));

	// The proposal's dry run is the heavy part, so it loads in the browser behind a skeleton.
	const proposalQuery = $derived(
		browser ? getChangeProposal({ wishlistShortId: shortId, proposalId }) : null,
	);
	const giftsQuery = $derived(browser ? getGiftsByWishlistShortId(shortId) : null);
	const categoriesQuery = $derived(browser && canManage ? getGiftCategories(wishlist.id) : null);
	const priorityLevelsQuery = $derived(
		browser && canManage ? getPriorityLevels(wishlist.id) : null,
	);
	const proposal = $derived(proposalQuery?.current);
	const listHref = $derived(localizeInternalHref(resolve('/(app)/w/[id]', { id: shortId })));

	function pageTitle() {
		return m.change_review_page_title({ title: wishlist.title });
	}

	async function discard() {
		await discardChangeProposal({ proposalId });
	}
</script>

<svelte:head>
	<title>{pageTitle()}</title>
</svelte:head>

<div class="review-page" data-palette={wishlist.palette}>
	{#if proposal !== undefined}
		<ChangeReview
			{proposal}
			wishlistTitle={wishlist.title}
			recipientName={wishlist.recipientDisplayName}
			{listHref}
			currentGifts={giftsQuery?.current?.gifts ?? []}
			categories={categoriesQuery?.current ?? []}
			priorityLevels={priorityLevelsQuery?.current ?? []}
			onapply={(selectedRowIds) => applyChangeProposal({ proposalId, selectedRowIds })}
			onundo={() => undoChangeProposal({ proposalId })}
			ondiscard={discard}
		/>
	{:else}
		<ChangeReviewHeader
			{listHref}
			wishlistTitle={wishlist.title}
			recipientName={wishlist.recipientDisplayName}
		/>
		{#if proposalQuery?.error}
			<Alert.Root tone="destructive" class="mt-4" data-testid="change-review-load-error">
				<TriangleAlertIcon />
				<Alert.Title>{m.change_review_load_error()}</Alert.Title>
				<Alert.Description>
					<Button
						intent="secondary"
						class="mt-2"
						onclick={() => proposalQuery?.refresh()}
					>
						{m.change_review_retry()}
					</Button>
				</Alert.Description>
			</Alert.Root>
		{:else}
			<ChangeReviewSkeleton />
		{/if}
	{/if}
</div>

<style>
	/* The apply bar sticks to the bottom of the scrolling content, flush with its edge. */
	.review-page {
		margin-bottom: calc(-1 * var(--space-6));
		padding-bottom: var(--space-6);
	}

	.review-page:has(:global([data-state='pending'])) {
		padding-bottom: 0;
	}
</style>
