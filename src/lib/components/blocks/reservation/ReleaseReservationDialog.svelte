<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';
	import { createDialogActionLock } from '$lib/components/base/dialog/dialog_action_lock.svelte.js';
	import {
		formatReservationTimestamp,
		reservationGifterName,
	} from '$lib/modules/reservations/reservation_display.js';
	import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
	import { releaseReservationDialogVariants } from './release_reservation_variants.js';

	interface ReleaseReservationDialogProps {
		open: boolean;
		giftName: string;
		/** The gift's release ledger, the viewer's own reservation already stripped server-side. */
		reservations: ReservationForModerator[];
		isReleasing?: boolean;
		onrelease?: (reservationId: string) => void;
		onclose?: () => void;
		onCloseAutoFocus?: (event: Event) => void;
	}

	let {
		open = $bindable(false),
		giftName,
		reservations,
		isReleasing = false,
		onrelease,
		onclose,
		onCloseAutoFocus,
	}: ReleaseReservationDialogProps = $props();

	const styles = releaseReservationDialogVariants();

	// The picked row drives the two-state flow: null = picker, set = confirmation. The confirmation
	// mirrors ConfirmDialog, which cannot host the picker step inside the same dialog.
	let pickedReservationId = $state<string | null>(null);
	let contentRef = $state<HTMLElement | null>(null);
	const lock = createDialogActionLock({ pending: () => isReleasing, content: () => contentRef });

	// A gift holding exactly one releasable reservation has nothing to pick (REQ-4), so the
	// dialog opens straight on the confirmation. Any other shape — several rows, or a single
	// row this viewer may only LOOK at (a správce on a signed-in gifter) — shows the picker.
	const soleReleasableReservation = $derived(
		reservations.length === 1 && reservations[0]!.releasable ? reservations[0]! : null,
	);
	const pickedReservation = $derived(
		reservations.find((row) => row.id === pickedReservationId) ?? soleReleasableReservation,
	);

	function pickReservation(reservation: ReservationForModerator) {
		pickedReservationId = reservation.id;
	}

	function handleConfirm() {
		if (pickedReservation === null) {
			return;
		}
		onrelease?.(pickedReservation.id);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (lock.busy) {
			return;
		}
		if (nextOpen) {
			pickedReservationId = null;
		} else {
			onclose?.();
		}
		open = nextOpen;
	}
</script>

<Dialog.Root bind:open={() => open, handleOpenChange}>
	<Dialog.Content bind:ref={contentRef} size="md" showCloseButton={!lock.busy} {onCloseAutoFocus}>
		{#if pickedReservation !== null}
			<div data-testid="release-reservation-confirm">
				<Dialog.Header>
					<Dialog.Title>{m.reserve_release_confirm_title()}</Dialog.Title>
					<Dialog.Description class={styles.confirmBody()}>
						{m.reserve_release_confirm_description({
							gift: giftName,
							gifter: reservationGifterName(pickedReservation),
						})}
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button
						intent="outline"
						disabled={lock.busy}
						onclick={() => handleOpenChange(false)}
					>
						{m.cancel()}
					</Button>
					<Button
						intent="danger"
						disabled={lock.busy}
						aria-busy={lock.busy}
						data-testid="release-reservation-confirm-action"
						onclick={handleConfirm}
					>
						{#if lock.busy}
							<Spinner data-icon="inline-start" />
							{m.reserve_release_submitting()}
						{:else}
							{m.reserve_release_confirm_action()}
						{/if}
					</Button>
				</Dialog.Footer>
			</div>
		{:else}
			<Dialog.Header>
				<Dialog.Title>{m.reserve_release_picker_title()}</Dialog.Title>
				<Dialog.Description class={styles.confirmBody()}>
					{m.reserve_release_picker_description({ gift: giftName })}
				</Dialog.Description>
			</Dialog.Header>
			<div class={styles.body()}>
				{#each reservations as reservation (reservation.id)}
					<div
						class={styles.row()}
						data-testid="release-reservation-row"
						data-reservation-id={reservation.id}
					>
						<div class={styles.rowInfo()}>
							<span
								class={styles.rowName()}
								data-testid="release-reservation-row-name"
								>{reservationGifterName(reservation)}</span
							>
							<span class={styles.rowMeta()}>
								{m.reserve_release_row_quantity({ count: reservation.quantity })}
								&middot;
								{formatReservationTimestamp(reservation.createdAt)}
							</span>
						</div>
						<div class={styles.rowAction()}>
							<Button
								size="sm"
								intent="danger"
								disabled={!reservation.releasable}
								data-testid="release-reservation-row-action"
								onclick={() => pickReservation(reservation)}
							>
								{m.reserve_release_row_action()}
							</Button>
							{#if !reservation.releasable}
								<!-- Visible but out of reach: a správce SEES a signed-in gifter's row
								     (they already see the reservation), so a disabled control with the
								     reason leaks nothing the ledger did not already show. -->
								<span class={styles.rowBlockedReason()}>
									{m.reserve_release_row_blocked()}
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
