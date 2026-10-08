<script lang="ts">
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import type { GiftBrowseActionHandlers } from './gift_presentation_props.js';
	import type { GiftBrowseActions } from '$lib/modules/gifts/gift_display_state.js';
	import type { GiftContextAction } from '$lib/modules/gifts/gift_context_actions.js';
	import type { GiftByRole, GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftActionRow from './GiftActionRow.svelte';
	import GiftReceivedToggle from './GiftReceivedToggle.svelte';

	interface GiftBrowseActionsProps extends GiftBrowseActionHandlers {
		gift: GiftByRole;
		visitorGift: GiftForVisitor | null;
		role: WishlistRole;
		isArchived: boolean;
		actions: GiftBrowseActions;
		contentWidth: number;
		receivedPending: boolean;
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
