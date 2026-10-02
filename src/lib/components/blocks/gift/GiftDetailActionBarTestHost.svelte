<script lang="ts">
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import GiftDetailActionBar from './GiftDetailActionBar.svelte';

	interface GiftDetailActionBarTestHostProps {
		gift: GiftForVisitor;
		role: 'visitor' | 'admin';
		reservations?: ReservationForModerator[];
		isAuthenticated?: boolean;
	}

	let {
		gift,
		role,
		reservations = [],
		isAuthenticated = true,
	}: GiftDetailActionBarTestHostProps = $props();

	setGiftsContext(
		() => gift.wishlistId,
		() => [gift],
		() => 'visitor',
		() => false,
		() => isAuthenticated,
		() => [],
	);

	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setReservationsContext(
		() =>
			role === 'admin'
				? RESERVATION_RELEASE_CAPABILITY.any
				: RESERVATION_RELEASE_CAPABILITY.none,
		() => reservations,
		async () => false,
	);
</script>

<GiftDetailActionBar {gift} />
