<script lang="ts">
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import type { ReservationReleaseCapability } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import ReleaseReservationButton from './ReleaseReservationButton.svelte';
	import GiftDetailForm from '$lib/components/blocks/gift/GiftDetailForm.svelte';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';

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
		placement?: 'direct' | 'form' | 'detail';
		role?: WishlistRole;
		hideReservationState?: boolean;
	}

	let {
		gift,
		capability,
		reservations,
		release = async () => true,
		placement = 'direct',
		role = 'moderator',
		hideReservationState = false,
	}: ReleaseReservationTestHostProps = $props();

	setReservationsContext(
		() => capability,
		() => reservations,
		(giftId, reservationId) => release(giftId, reservationId),
	);
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
</script>

{#if placement === 'form'}
	<GiftDetailForm
		mode="edit"
		{gift}
		wishlistId={gift.wishlistId}
		priorityLevels={[]}
		{role}
		{hideReservationState}
		postShareLocked={false}
		canDelete={false}
		isSubmitting={false}
		isDeleting={false}
	/>
{:else if placement === 'detail'}
	<GiftDetailModal
		open={true}
		mode="edit"
		{gift}
		wishlistId={gift.wishlistId}
		priorityLevels={[]}
		{role}
		readOnly={true}
		{hideReservationState}
	/>
{:else}
	<ReleaseReservationButton {gift} size="md" />
{/if}
