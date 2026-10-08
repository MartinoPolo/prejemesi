<script lang="ts">
	import { useReservations } from '$lib/modules/reservations/reservations.context.svelte.js';
	import ReleaseReservationDialog from './ReleaseReservationDialog.svelte';

	/**
	 * Picker, confirmation and release call for one gift's release ledger, shared by the release
	 * button and the administrator's gift More menu.
	 */
	interface ReleaseReservationFlowProps {
		open: boolean;
		giftId: string;
		giftName: string;
		disabled?: boolean;
		/**
		 * The More button that opened the flow from a menu. The menu is gone by then, so closing
		 * returns here, or to the dialog holding it when the button left the lane, never to body.
		 */
		returnFocusTo?: HTMLElement | null;
	}

	let {
		open = $bindable(false),
		giftId,
		giftName,
		disabled = false,
		returnFocusTo = null,
	}: ReleaseReservationFlowProps = $props();

	const reservations = useReservations();

	let isReleasing = $state(false);

	const releaseLedger = $derived(reservations.reservationsForGift(giftId));

	function isFocusable(element: HTMLElement): boolean {
		return (
			element.isConnected &&
			element.getClientRects().length > 0 &&
			element.closest('[inert], [aria-hidden="true"]') === null
		);
	}

	function restoreFocus(event: Event) {
		if (returnFocusTo === null) {
			return;
		}
		const holdingDialog = returnFocusTo.closest<HTMLElement>('[role="dialog"]');
		const focusTarget = isFocusable(returnFocusTo) ? returnFocusTo : holdingDialog;
		if (focusTarget !== null && focusTarget.isConnected) {
			event.preventDefault();
			focusTarget.focus({ preventScroll: true });
		}
	}

	async function handleRelease(reservationId: string) {
		if (disabled || isReleasing) {
			return;
		}
		isReleasing = true;
		try {
			const released = await reservations.release(giftId, reservationId);
			if (released) {
				open = false;
			}
		} finally {
			isReleasing = false;
		}
	}
</script>

<ReleaseReservationDialog
	bind:open
	{giftName}
	reservations={releaseLedger}
	isReleasing={isReleasing || disabled}
	onrelease={handleRelease}
	onCloseAutoFocus={restoreFocus}
/>
