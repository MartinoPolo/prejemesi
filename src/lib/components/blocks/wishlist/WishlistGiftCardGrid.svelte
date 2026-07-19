<script lang="ts">
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import { createGiftPointerReorderController } from './gift_pointer_reorder.svelte.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftCardGridProps {
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
	}: WishlistGiftCardGridProps = $props();

	let gridEl = $state<HTMLElement | null>(null);

	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			gridEl === null
				? []
				: Array.from(gridEl.querySelectorAll<HTMLElement>('[data-gift-item]')),
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

<!-- Each card band spans 7 rows of this grid (see gift_card_variants.ts): the wrapper and
     card are row subgrids, so price/priority/links/footer align across cards in a row.
     gap-5 stays between bands; inside a band the wrapper zeroes the row gap and the card
     sections space themselves with margins. -->
<div
	bind:this={gridEl}
	class="grid gap-5"
	style:grid-template-columns="repeat(auto-fill, minmax(280px, 1fr))"
>
	{#each gifts as giftItem, index (giftItem.id)}
		<WishlistGiftDraggableWrapper
			{index}
			{canManage}
			class="row-span-7 grid grid-rows-subgrid gap-y-0"
			draggedIndex={reorder.draggedIndex.current}
			dragOverIndex={reorder.dragOverIndex.current}
			dragOverStyle="ring"
			giftName={giftItem.name}
			onopendetail={() => onedit(giftItem)}
			onreorderpointerdown={reorder.start}
			onreordermove={handleReorderMove}
		>
			<GiftCard gift={giftItem} {role} {isArchived} {onreserve} {onunreserve} />
		</WishlistGiftDraggableWrapper>
	{/each}
</div>
