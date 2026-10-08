<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ControlSize } from '$lib/components/base/control_sizing.js';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import { useReservations } from '$lib/modules/reservations/reservations.context.svelte.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import ReleaseReservationFlow from './ReleaseReservationFlow.svelte';

	interface ReleaseReservationButtonProps {
		gift: GiftForVisitor;
		size?: ControlSize;
		disabled?: boolean;
		/** Extra classes on the underlying Button for stacked editor/action layouts. */
		class?: string;
	}

	let {
		gift,
		size,
		disabled = false,
		class: className,
	}: ReleaseReservationButtonProps = $props();

	const reservations = useReservations();

	/**
	 * The release ledger for this gift — the viewer's own reservation is already stripped
	 * server-side, so an empty ledger means there is nothing for this viewer to act on and the
	 * control stays hidden (their own reservation is cancelled from the reserve control).
	 * A row they may see but not release (správce, signed-in gifter) still counts: it renders
	 * disabled with a reason inside the picker.
	 */
	const canRelease = $derived(reservations.offersRelease(gift.id));

	let dialogOpen = $state(false);

	function handleOpenClick(event: MouseEvent) {
		event.stopPropagation();
		if (!disabled) {
			dialogOpen = true;
		}
	}
</script>

{#if canRelease}
	<!-- Capability and ledger gates remain owned by this component. -->
	<Button
		{size}
		intent="danger"
		aria-label={m.reserve_release_button_aria({ name: gift.name })}
		{disabled}
		onclick={handleOpenClick}
		data-testid="release-reservation-button"
		class={className}
	>
		<KeyRoundIcon data-icon="inline-start" />
		{m.reserve_release_button()}
	</Button>

	<ReleaseReservationFlow
		bind:open={dialogOpen}
		giftId={gift.id}
		giftName={gift.name}
		{disabled}
	/>
{/if}
