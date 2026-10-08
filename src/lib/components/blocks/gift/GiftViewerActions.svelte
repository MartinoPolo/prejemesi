<script lang="ts">
	import ReserveButton from '$lib/components/blocks/reservation/ReserveButton.svelte';
	import PurchasedToggle from '$lib/components/blocks/reservation/PurchasedToggle.svelte';
	import ReleaseReservationButton from '$lib/components/blocks/reservation/ReleaseReservationButton.svelte';
	import type { GiftMoreProps } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import { useGifts } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { deriveGiftBrowseActions } from '$lib/modules/gifts/gift_display_state.js';
	import {
		RELEASE_RESERVATION_ACTION,
		type GiftContextAction,
	} from '$lib/modules/gifts/gift_context_actions.js';
	import { useReservations } from '$lib/modules/reservations/reservations.context.svelte.js';
	import GiftActionRow from './GiftActionRow.svelte';
	import LikeButton from './LikeButton.svelte';
	import { giftViewerVariants } from './gift_viewer_variants.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';

	interface GiftViewerActionsProps extends GiftMoreProps {
		gift: GiftForVisitor;
		role: WishlistRole;
		isArchived: boolean;
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let {
		gift,
		role,
		isArchived,
		onreserve,
		onunreserve,
		onmore,
		moreOpen = false,
		moreSurface = 'menu',
	}: GiftViewerActionsProps = $props();

	const giftsContext = useGifts();
	const reservations = useReservations();

	const styles = giftViewerVariants();
	// Reserved by someone else leaves no primary: the state badges already say so.
	const browseActions = $derived(
		deriveGiftBrowseActions({
			role,
			visitorGift: gift,
			isFullyReserved: gift.isFullyReserved,
			isArchived,
			isAuthenticated: giftsContext.isAuthenticated.current,
			contextualMode: false,
			canMarkReceived: false,
		}),
	);
	// Ordered by overflow priority: Koupeno leaves the lane first, then Uvolnit.
	const secondaryActions = $derived<readonly GiftContextAction[]>([
		...browseActions.secondaryActions,
		...(reservations.offersRelease(gift.id) ? [RELEASE_RESERVATION_ACTION] : []),
	]);
	const secondaryActionsAfterPrimary: readonly GiftContextAction[] = [RELEASE_RESERVATION_ACTION];
</script>

{#snippet like()}
	<LikeButton giftId={gift.id} giftName={gift.name} likeCount={gift.likeCount} />
{/snippet}

{#snippet secondaryAction(action: GiftContextAction)}
	{#if action === 'purchased'}
		<PurchasedToggle {gift} />
	{:else if action === RELEASE_RESERVATION_ACTION}
		<ReleaseReservationButton {gift} />
	{/if}
{/snippet}

<div class={styles.footer()} data-testid="gift-viewer-footer">
	<GiftActionRow
		leading={like}
		secondary={secondaryAction}
		{secondaryActions}
		{secondaryActionsAfterPrimary}
		primaryAction={browseActions.primaryAction}
		{onmore}
		persistentMore={false}
		{moreOpen}
		{moreSurface}
	>
		{#if browseActions.primaryAction !== undefined}
			<ReserveButton {gift} {isArchived} {onreserve} {onunreserve} />
		{/if}
	</GiftActionRow>
</div>
