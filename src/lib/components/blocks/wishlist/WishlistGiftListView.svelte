<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import GiftSectionHeader from './GiftSectionHeader.svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import { giftSectionHasHeader, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import {
		toIndexedSections,
		countGiftsInSections,
		sectionRenderKey,
	} from './gift_section_rows.js';

	interface WishlistGiftListViewProps {
		sections: GiftSection[];
		role: WishlistRole;
		isArchived: boolean;
		canManage: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreorder: (fromIndex: number, toIndex: number) => void;
	}

	let {
		sections,
		role,
		isArchived,
		canManage,
		onedit,
		onreserve,
		onunreserve,
		onreorder,
	}: WishlistGiftListViewProps = $props();

	let listEl = $state<HTMLElement | null>(null);

	const indexedSections = $derived(toIndexedSections(sections));
	const totalGiftCount = $derived(countGiftsInSections(sections));

	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			listEl === null
				? []
				: Array.from(listEl.querySelectorAll<HTMLElement>('[data-gift-item]')),
		onReorder: (fromIndex, toIndex) => onreorder(fromIndex, toIndex),
	});

	function handleReorderMove(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target >= 0 && target < totalGiftCount) {
			onreorder(index, target);
		}
	}

	$effect(() => () => reorder.destroy());
</script>

<div bind:this={listEl} class="flex flex-col">
	{#each indexedSections as { section, items } (sectionRenderKey(section, items))}
		{#if giftSectionHasHeader(section)}
			<GiftSectionHeader {section} />
		{/if}
		{#each items as { gift: giftItem, index } (giftItem.id)}
			<WishlistGiftDraggableWrapper
				{index}
				{canManage}
				draggedIndex={reorder.draggedIndex.current}
				dragOverIndex={reorder.dragOverIndex.current}
				dragOverStyle="bg"
				giftName={giftItem.name}
				onopendetail={() => onedit(giftItem)}
				onreorderpointerdown={reorder.start}
				onreordermove={handleReorderMove}
			>
				<GiftListItem gift={giftItem} {role} {isArchived} {onreserve} {onunreserve} />
			</WishlistGiftDraggableWrapper>
		{/each}
	{/each}
</div>
