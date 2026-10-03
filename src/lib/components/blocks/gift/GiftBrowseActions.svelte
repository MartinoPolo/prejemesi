<script lang="ts">
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftActionPlacementSnapshot } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import type { GiftBrowseActions } from '$lib/modules/gifts/gift_browse_actions.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftActionRow from './GiftActionRow.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';

	interface GiftBrowseActionsProps {
		gift: GiftByRole;
		visitorGift: GiftForVisitor | null;
		role: WishlistRole;
		isArchived: boolean;
		actions: GiftBrowseActions;
		contentWidth: number;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onreceived?: (giftId: string, received: boolean) => void;
		receivedPending: boolean;
		onmore?: (
			anchor: HTMLButtonElement,
			placementSnapshot: GiftActionPlacementSnapshot,
		) => void;
		persistentMore: boolean;
		moreOpen: boolean;
		moreSurface: 'menu' | 'dialog';
		class?: string;
	}

	let {
		gift,
		visitorGift,
		role,
		isArchived,
		actions,
		contentWidth,
		onreserve,
		onunreserve,
		onreceived,
		receivedPending,
		onmore,
		persistentMore,
		moreOpen,
		moreSurface,
		class: className,
	}: GiftBrowseActionsProps = $props();
</script>

{#snippet receivedToggle()}
	<GiftReceivedToggle
		giftId={gift.id}
		received={gift.received}
		{role}
		{isArchived}
		{onreceived}
		pending={receivedPending}
		compactLabel
	/>
{/snippet}

{#snippet secondaryAction(action: GiftContextAction)}
	{#if action === 'received'}
		{@render receivedToggle()}
	{:else if action === 'purchased' && visitorGift}
		<PurchasedToggle gift={visitorGift} />
	{/if}
{/snippet}

<GiftActionRow
	class={className}
	{onmore}
	{persistentMore}
	{moreOpen}
	{moreSurface}
	{contentWidth}
	secondary={actions.secondaryActions.length > 0 ? secondaryAction : undefined}
	secondaryActions={actions.secondaryActions}
	primaryAction={actions.primaryAction}
>
	{#if actions.primaryAction === 'received'}
		{@render receivedToggle()}
	{:else if actions.primaryAction !== undefined && visitorGift}
		<ReserveButton gift={visitorGift} {isArchived} {onreserve} {onunreserve} />
	{/if}
</GiftActionRow>
