<script lang="ts">
	import GiftCard from '$lib/components/blocks/gift/GiftCard.svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftCardGridProps {
		gifts: GiftByRole[];
		role: WishlistRole;
		isArchived: boolean;
		isOwnerOrModerator: boolean;
		draggedIndex: number | null;
		dragOverIndex: number | null;
		onedit: (gift: GiftByRole) => void;
		onreserve: (gift: GiftForVisitor) => void;
		onunreserve: (gift: GiftForVisitor) => void;
		ondragstart: (event: DragEvent, index: number) => void;
		ondragover: (event: DragEvent, index: number) => void;
		ondragleave: () => void;
		ondrop: (event: DragEvent, index: number) => void;
		ondragend: () => void;
	}

	let {
		gifts,
		role,
		isArchived,
		isOwnerOrModerator,
		draggedIndex,
		dragOverIndex,
		onedit,
		onreserve,
		onunreserve,
		ondragstart,
		ondragover,
		ondragleave,
		ondrop,
		ondragend,
	}: WishlistGiftCardGridProps = $props();
</script>

<div class="grid gap-5" style:grid-template-columns="repeat(auto-fill, minmax(280px, 1fr))">
	{#each gifts as giftItem, index (giftItem.id)}
		<WishlistGiftDraggableWrapper
			{index}
			{isOwnerOrModerator}
			{draggedIndex}
			{dragOverIndex}
			dragOverStyle="ring"
			onedit={() => onedit(giftItem)}
			ondragstart={(e) => ondragstart(e, index)}
			ondragover={(e) => ondragover(e, index)}
			{ondragleave}
			ondrop={(e) => ondrop(e, index)}
			{ondragend}
		>
			<GiftCard gift={giftItem} {role} {isArchived} {onreserve} {onunreserve} />
		</WishlistGiftDraggableWrapper>
	{/each}
</div>
