<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import { useReservations } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import ReleaseReservationDialog from './ReleaseReservationDialog.svelte';

	interface ReleaseReservationButtonProps {
		gift: GiftForVisitor;
		size?: 'md' | 'sm';
		/** Extra classes on the underlying Button for stacked editor/action layouts. */
		class?: string;
	}

	let { gift, size = 'sm', class: className }: ReleaseReservationButtonProps = $props();

	const reservations = useReservations();

	/**
	 * The release ledger for this gift — the viewer's own reservation is already stripped
	 * server-side, so an empty ledger means there is nothing for this viewer to act on and the
	 * control stays hidden (their own reservation is cancelled from the reserve control).
	 * A row they may see but not release (správce, signed-in gifter) still counts: it renders
	 * disabled with a reason inside the picker.
	 */
	const releaseLedger = $derived(reservations.reservationsForGift(gift.id));
	const canRelease = $derived(
		reservations.capability !== RESERVATION_RELEASE_CAPABILITY.none && releaseLedger.length > 0,
	);

	let dialogOpen = $state(false);
	let isReleasing = $state(false);

	function handleOpenClick(event: MouseEvent) {
		event.stopPropagation();
		dialogOpen = true;
	}

	async function handleRelease(reservationId: string) {
		isReleasing = true;
		try {
			const released = await reservations.release(gift.id, reservationId);
			if (released) {
				dialogOpen = false;
			}
		} finally {
			isReleasing = false;
		}
	}
</script>

{#if canRelease}
	<!-- Capability and ledger gates remain owned by this component. -->
	<Button
		{size}
		intent="danger"
		aria-label={m.reserve_release_button_aria({ name: gift.name })}
		onclick={handleOpenClick}
		data-testid="release-reservation-button"
		class={className}
	>
		<KeyRoundIcon data-icon="inline-start" />
		{m.reserve_release_button()}
	</Button>

	<ReleaseReservationDialog
		bind:open={dialogOpen}
		giftName={gift.name}
		reservations={releaseLedger}
		{isReleasing}
		onrelease={handleRelease}
	/>
{/if}
