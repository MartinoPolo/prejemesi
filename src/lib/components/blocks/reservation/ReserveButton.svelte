<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

	interface ReserveButtonProps {
		gift: GiftForVisitor;
		isArchived?: boolean;
		size?: 'md' | 'sm';
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
	}

	let {
		gift,
		isArchived = false,
		size = 'sm',
		onreserve,
		onunreserve,
	}: ReserveButtonProps = $props();

	const hasMyReservation = $derived(gift.myReservationId !== null);
	const isFullyReserved = $derived(gift.isFullyReserved);

	function handleReserveClick(event: MouseEvent) {
		event.stopPropagation();
		if (!isFullyReserved && !isArchived) {
			onreserve?.(gift);
		}
	}

	function handleUnreserveClick(event: MouseEvent) {
		event.stopPropagation();
		onunreserve?.(gift);
	}
</script>

{#if hasMyReservation}
	<!-- Current user holds a reservation – allow cancelling (even on archived lists) -->
	<Button
		{size}
		intent="danger"
		aria-label={m.reserve_button_cancel_aria({ name: gift.name })}
		onclick={handleUnreserveClick}
	>
		{m.reserve_button_cancel()}
	</Button>
{:else if !isArchived}
	<Button
		{size}
		intent={isFullyReserved ? 'outline' : 'primary'}
		disabled={isFullyReserved}
		aria-label={m.reserve_button_reserve_aria({ name: gift.name })}
		onclick={handleReserveClick}
	>
		{#if isFullyReserved}
			{m.reserve_button_reserved()}
		{:else}
			{m.reserve_button_reserve()}
		{/if}
	</Button>
{/if}
