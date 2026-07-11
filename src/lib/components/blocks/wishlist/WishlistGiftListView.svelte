<script lang="ts">
	import GiftListItem from '$lib/components/blocks/gift/GiftListItem.svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';
	import { normalizeGiftUrl, getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface WishlistGiftListViewProps {
		gifts: GiftByRole[];
		role: WishlistRole;
		isArchived: boolean;
		canManage: boolean;
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
		canManage,
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
	}: WishlistGiftListViewProps = $props();
</script>

<div class="flex flex-col">
	{#each gifts as giftItem, index (giftItem.id)}
		<WishlistGiftDraggableWrapper
			{index}
			{canManage}
			{draggedIndex}
			{dragOverIndex}
			dragOverStyle="bg"
			visitorLinkHref={normalizeGiftUrl(getPrimaryGiftLink(giftItem.links)?.url ?? null)}
			onedit={() => onedit(giftItem)}
			ondragstart={(e) => ondragstart(e, index)}
			ondragover={(e) => ondragover(e, index)}
			{ondragleave}
			ondrop={(e) => ondrop(e, index)}
			{ondragend}
		>
			<GiftListItem gift={giftItem} {role} {isArchived} {onreserve} {onunreserve} />
		</WishlistGiftDraggableWrapper>
	{/each}
</div>
