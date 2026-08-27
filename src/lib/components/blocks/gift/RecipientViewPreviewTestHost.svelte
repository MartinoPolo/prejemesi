<script lang="ts">
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftCard from './GiftCard.svelte';
	import GiftListItem from './GiftListItem.svelte';
	import GiftCompactRow from './GiftCompactRow.svelte';
	import GiftDetailView from './GiftDetailView.svelte';

	interface Props {
		gift: GiftForVisitor;
		role: WishlistRole;
		surface: 'card' | 'list' | 'compact' | 'detail';
		hideReservationState?: boolean;
		onreceived?: (giftId: string, received: boolean) => void;
	}

	let { gift, role, surface, hideReservationState = true, onreceived }: Props = $props();

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => 'test-wishlist',
		() => [gift],
		() => role,
		() => false,
		() => true,
		() => [],
	);
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.guestOnly,
		() => [
			{
				id: 'reservation-other',
				giftId: gift.id,
				quantity: 2,
				displayName: 'Babička',
				releasable: true,
				createdAt: new Date('2026-01-01T00:00:00Z'),
			},
		],
		async () => true,
	);
</script>

{#if surface === 'card'}
	<GiftCard {gift} {role} {hideReservationState} {onreceived} />
{:else if surface === 'list'}
	<GiftListItem {gift} {role} {hideReservationState} {onreceived} />
{:else if surface === 'compact'}
	<table>
		<tbody><GiftCompactRow {gift} {role} {hideReservationState} {onreceived} /></tbody>
	</table>
{:else}
	<GiftDetailView {gift} {role} {hideReservationState} />
{/if}
