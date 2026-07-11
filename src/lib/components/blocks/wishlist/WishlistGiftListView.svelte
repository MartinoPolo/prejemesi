<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftListViewProps {
		gifts: GiftByRole[];
		role: WishlistRole;
		isArchived: boolean;
		canManage: boolean;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		onreorder: (fromIndex: number, toIndex: number) => void;
	}

	let {
		gifts,
		role,
		isArchived,
		canManage,
		onedit,
		onreserve,
		onunreserve,
		onreorder,
	}: WishlistGiftListViewProps = $props();

	let listEl = $state<HTMLElement | null>(null);

	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			listEl === null
				? []
				: Array.from(listEl.querySelectorAll<HTMLElement>('[data-gift-item]')),
		onReorder: (fromIndex, toIndex) => onreorder(fromIndex, toIndex),
	});

	function handleReorderMove(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target >= 0 && target < gifts.length) {
			onreorder(index, target);
		}
	}

	$effect(() => () => reorder.destroy());
</script>

<div bind:this={listEl} class="flex flex-col">
	{#each gifts as giftItem, index (giftItem.id)}
		<WishlistGiftDraggableWrapper
			{index}
			{canManage}
			draggedIndex={reorder.draggedIndex.current}
			dragOverIndex={reorder.dragOverIndex.current}
			dragOverStyle="bg"
			visitorLinkHref={normalizeGiftUrl(getPrimaryGiftLink(giftItem.links)?.url ?? null)}
			onedit={() => onedit(giftItem)}
			onreorderpointerdown={reorder.start}
			onreordermove={handleReorderMove}
		>
			<GiftListItem gift={giftItem} {role} {isArchived} {onreserve} {onunreserve} />
		</WishlistGiftDraggableWrapper>
	{/each}
</div>
