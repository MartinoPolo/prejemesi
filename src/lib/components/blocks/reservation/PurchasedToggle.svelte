<script lang="ts">
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ControlSize } from '$lib/components/base/control_sizing.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { useGifts } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { canTrackPurchase } from '$lib/modules/gifts/gift_context_actions.js';
	import { setReservationPurchased } from '$lib/modules/reservations/reservations.remote.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface PurchasedToggleProps {
		gift: GiftForVisitor;
		size?: ControlSize;
	}

	let { gift, size }: PurchasedToggleProps = $props();

	const giftsContext = useGifts();

	const canTrack = $derived(
		canTrackPurchase({
			isAuthenticated: giftsContext.isAuthenticated.current,
			isArchived: giftsContext.archived.current,
			ownsReservation: gift.myReservationId !== null,
		}),
	);

	// Optimistic override wins until the fresh gift data rides back on the command's
	// single-flight refresh (issue #108); list surfaces re-fetch when next opened.
	let optimistic = $state<boolean | null>(null);
	const purchased = $derived(optimistic ?? gift.myReservationPurchasedAt !== null);
	let isSaving = $state(false);

	async function handleToggle(event: MouseEvent) {
		event.stopPropagation();
		if (gift.myReservationId === null || isSaving) {
			return;
		}
		const next = !purchased;
		optimistic = next;
		isSaving = true;
		try {
			await setReservationPurchased({ reservationId: gift.myReservationId, purchased: next });
			toastSuccess(next ? m.toast_marked_bought() : m.toast_unmarked_bought());
		} catch {
			optimistic = !next;
			toastError(m.toast_bought_error());
		} finally {
			isSaving = false;
		}
	}
</script>

{#if canTrack}
	<Button
		{size}
		intent={purchased ? 'danger' : 'secondary-filled'}
		disabled={isSaving}
		aria-pressed={purchased}
		aria-label={purchased ? m.gift_mark_unbought() : m.gift_mark_bought()}
		onclick={handleToggle}
	>
		{#if purchased}<Undo2Icon data-icon="inline-start" aria-hidden="true" />{/if}
		{purchased ? m.gift_unbought_compact() : m.gift_bought()}
	</Button>
{/if}
