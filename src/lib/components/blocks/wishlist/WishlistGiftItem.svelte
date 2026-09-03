<script lang="ts">
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import { getPrimaryGiftLink } from '$lib/modules/gifts/gift_url.js';
	import { getContext, type Snippet } from 'svelte';
	import WishlistGiftDraggableWrapper from './WishlistGiftDraggableWrapper.svelte';

	interface Props {
		gift: GiftByRole;
		index: number;
		totalCount: number;
		reorderEnabled: boolean;
		draggedGiftId: string | null;
		dragOverGiftId: string | null;
		dragOverStyle: 'ring' | 'bg';
		class?: string;
		selectionMode?: boolean;
		selectionLayout?: 'overlay' | 'list';
		onselectiontoggle?: (giftId: string) => void;
		oncontextactions?: (gift: GiftByRole, event: MouseEvent | null) => boolean;
		onedit: (gift: GiftByRole) => void;
		onreorderpointerdown: (event: PointerEvent, index: number) => void;
		onreordermove: (index: number, direction: -1 | 1) => void;
		children: Snippet<[GiftByRole]>;
	}

	let {
		gift,
		index,
		totalCount,
		reorderEnabled,
		draggedGiftId,
		dragOverGiftId,
		dragOverStyle,
		class: className = undefined,
		selectionMode = false,
		selectionLayout = 'overlay',
		onselectiontoggle,
		oncontextactions,
		onedit,
		onreorderpointerdown,
		onreordermove,
		children,
	}: Props = $props();

	const isSelected = getContext<((giftId: string) => boolean) | undefined>(
		'wishlist-gift-selection',
	);
	const selected = $derived(isSelected?.(gift.id) ?? false);
	const primaryLink = $derived(getPrimaryGiftLink(gift.links)?.url ?? null);
</script>

<WishlistGiftDraggableWrapper
	{index}
	{totalCount}
	giftId={gift.id}
	{reorderEnabled}
	{draggedGiftId}
	{dragOverGiftId}
	{dragOverStyle}
	giftName={gift.name}
	{primaryLink}
	class={className}
	{selectionMode}
	{selectionLayout}
	{selected}
	{onselectiontoggle}
	oncontextmenu={(event) => oncontextactions?.(gift, event) ?? false}
	onlongpress={() => oncontextactions?.(gift, null)}
	onopendetail={() => onedit(gift)}
	{onreorderpointerdown}
	{onreordermove}
>
	{@render children(gift)}
</WishlistGiftDraggableWrapper>
