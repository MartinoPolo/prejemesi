<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';

	interface WishlistEmptyStateProps {
		isArchived: boolean;
		isOwner: boolean;
		isFilteredEmpty: boolean;
		onaddgift: () => void;
		onclearfilters: () => void;
	}

	let {
		isArchived,
		isOwner,
		isFilteredEmpty,
		onaddgift,
		onclearfilters,
	}: WishlistEmptyStateProps = $props();
</script>

{#if isFilteredEmpty}
	<EmptyState
		emoji="🔍"
		title={m.wishlist_detail_no_filter_results_title()}
		description={m.wishlist_detail_no_filter_results_description()}
	>
		{#snippet actions()}
			<Button intent="outline" onclick={onclearfilters}
				>{m.wishlist_detail_clear_filters()}</Button
			>
		{/snippet}
	</EmptyState>
{:else if isArchived}
	<EmptyState
		emoji="🗄️"
		title={m.wishlist_detail_archived_empty_title()}
		description={m.wishlist_detail_archived_empty_description()}
	/>
{:else if isOwner}
	<EmptyState
		emoji="🎁"
		title={m.wishlist_detail_owner_empty_title()}
		description={m.wishlist_detail_owner_empty_description()}
	>
		{#snippet actions()}
			<Button aria-label={m.wishlist_detail_add_first_wish_label()} onclick={onaddgift}>
				<PlusIcon data-icon="inline-start" />
				{m.wishlist_detail_add_first_wish()}
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	<EmptyState
		emoji="🎁"
		title={m.wishlist_detail_visitor_empty_title()}
		description={m.wishlist_detail_visitor_empty_description()}
	/>
{/if}
