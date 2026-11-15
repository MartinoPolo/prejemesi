<script lang="ts">
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { useGifts } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { canTrackPurchase } from '$lib/modules/gifts/gift_display_state.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface PurchasedToggleProps {
		gift: GiftForVisitor;
	}

	let { gift }: PurchasedToggleProps = $props();

	const giftsContext = useGifts();

	const canTrack = $derived(
		canTrackPurchase({
			isAuthenticated: giftsContext.isAuthenticated.current,
			isArchived: giftsContext.archived.current,
			ownsReservation: gift.myReservationId !== null,
		}),
	);

	const purchased = $derived(giftsContext.purchased.isPurchased(gift));
	const isSaving = $derived(giftsContext.purchased.isPending(gift));

	function handleToggle(event: MouseEvent) {
		event.stopPropagation();
		void giftsContext.purchased.toggle(gift);
	}
</script>

{#if canTrack}
	<Button
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
