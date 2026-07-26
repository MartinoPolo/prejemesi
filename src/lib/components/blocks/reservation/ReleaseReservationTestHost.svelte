<script lang="ts">
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import type { ReservationReleaseCapability } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import ReleaseReservationButton from './ReleaseReservationButton.svelte';

	/**
	 * Test/story-only harness: `ReleaseReservationButton` reads `useReservations()`, which only
	 * the real wishlist page (`/w/[id]/+page.svelte`) provides. This stands in for that page so
	 * the release flow can be driven with fixture ledgers instead of a live server.
	 */
	interface ReleaseReservationTestHostProps {
		gift: GiftForVisitor;
		capability: ReservationReleaseCapability;
		reservations: ReservationForModerator[];
		release?: (giftId: string, reservationId: string) => Promise<boolean>;
	}

	let {
		gift,
		capability,
		reservations,
		release = async () => true,
	}: ReleaseReservationTestHostProps = $props();

	setReservationsContext(
		() => capability,
		() => reservations,
		(giftId, reservationId) => release(giftId, reservationId),
	);
</script>

<ReleaseReservationButton {gift} size="md" />
