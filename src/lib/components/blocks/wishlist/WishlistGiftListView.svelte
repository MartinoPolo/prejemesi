<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import GiftReorderDropZone from './GiftReorderDropZone.svelte';
	import WishlistGiftItem from './WishlistGiftItem.svelte';
	import {
		createWishlistGiftCollectionView,
		type WishlistGiftCollectionProps,
	} from './wishlist_gift_collection.svelte.js';
	import { GIFT_DISPLAY_ROW_KINDS } from './gift_section_rows.js';

	let collection: WishlistGiftCollectionProps = $props();

	let listEl = $state<HTMLElement | null>(null);

	const collectionView = createWishlistGiftCollectionView(
		() => collection,
		() => listEl,
	);
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
	{collectionView.announcement}
</div>

<div
	bind:this={listEl}
	data-testid="wishlist-gift-list"
	class="isolate flex flex-col gap-2.5 sm:gap-4"
>
	{#each collectionView.displayRows as row (row.key)}
		{#if row.kind === GIFT_DISPLAY_ROW_KINDS.header}
			<GiftSectionHeader {...collectionView.sectionHeaderProps(row.section)} />
		{:else if row.kind === GIFT_DISPLAY_ROW_KINDS.dropZone}
			<GiftReorderDropZone groupKey={row.section.key} />
		{:else}
			<WishlistGiftItem
				{...collectionView.giftItemProps(row)}
				selectionLayout="list"
				dragOverStyle="bg"
			>
				{#snippet children(giftItem)}
					<GiftListItem {...collectionView.giftPresentationProps(giftItem)} />
				{/snippet}
			</WishlistGiftItem>
		{/if}
	{/each}
</div>
