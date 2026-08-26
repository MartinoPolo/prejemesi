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
		hideReservationState: boolean;
		reorderEnabled: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreceived: (giftId: string, received: boolean) => void;
		onreorderpreview: (orderedIds: string[]) => void;
		onreordercommit: (orderedIds: string[]) => void;
		onreordercancel: (orderedIds: string[]) => void;
	}

	let {
		sections,
		role,
		isArchived,
		hideReservationState,
		reorderEnabled,
		onedit,
		onreserve,
		onunreserve,
		onreceived,
		onreorderpreview,
		onreordercommit,
		onreordercancel,
	}: WishlistGiftListViewProps = $props();

	let listEl = $state<HTMLElement | null>(null);

	const indexedSections = $derived(toIndexedSections(sections));
	const totalGiftCount = $derived(countGiftsInSections(sections));

	function getItemElements() {
		return listEl === null
			? []
			: Array.from(listEl.querySelectorAll<HTMLElement>('[data-gift-item]'));
	}

	const reorder = createGiftPointerReorderController({
		getItemElements,
		getItemIds: () => getItemElements().map((element) => element.dataset.giftId!),
		onPreviewOrder: (orderedIds) => onreorderpreview(orderedIds),
		onCommitOrder: (orderedIds) => onreordercommit(orderedIds),
		onCancelOrder: (orderedIds) => onreordercancel(orderedIds),
	});

	function handleReorderMove(index: number, direction: -1 | 1) {
		if (index + direction >= 0 && index + direction < totalGiftCount) {
			reorder.move(index, direction);
		}
	}

	$effect(() => {
		if (!reorderEnabled) {
			reorder.cancel();
		}
	});
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
				giftId={giftItem.id}
				{reorderEnabled}
				draggedGiftId={reorder.draggedGiftId.current}
				dragOverGiftId={reorder.dragOverGiftId.current}
				dragOverStyle="bg"
				giftName={giftItem.name}
				onopendetail={() => onedit(giftItem)}
				onreorderpointerdown={reorder.start}
				onreordermove={handleReorderMove}
			>
				<GiftListItem
					gift={giftItem}
					{role}
					{isArchived}
					{hideReservationState}
					{onreserve}
					{onunreserve}
					{onreceived}
				/>
			</WishlistGiftDraggableWrapper>
		{/each}
	{/each}
</div>
