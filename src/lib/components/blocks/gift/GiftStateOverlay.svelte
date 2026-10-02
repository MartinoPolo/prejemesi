<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftOverlayKind,
		GiftStateOverlayModel,
	} from '$lib/modules/gifts/gift_display_state.js';
	import { formatOtherReservationLabel } from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';
	import { giftStateBadgeVariants } from './gift_state_overlay_variants.js';

	interface GiftStateOverlayProps {
		model: GiftStateOverlayModel | null;
		/** Compact labels only when a narrow containing image also has a top-right control. */
		avoidTopRight?: boolean;
		class?: string;
	}

	let { model, avoidTopRight = false, class: className }: GiftStateOverlayProps = $props();

	function label(kind: GiftOverlayKind, state: GiftStateOverlayModel): string {
		switch (kind) {
			case 'received':
				return m.gift_received_badge();
			case 'own-reservation':
				return m.gift_reserved_by_me_overlay();
			case 'own-purchased':
				return m.gift_bought();
			case 'unavailable':
				return formatOtherReservationLabel(state.otherReservers);
			case 'partial':
				return m.gift_remaining_capacity({
					remaining: state.remaining ?? 0,
					total: state.total ?? 0,
				});
		}
	}

	const primaryLabel = $derived(model === null ? null : label(model.kind, model));
	const supportLabel = $derived(
		model?.supportKind === undefined ? null : label(model.supportKind, model),
	);
	// Authorized identity joins the group as the other-reservation badge when no state badge
	// already carries it, so names never appear as a separate chip.
	const separateOtherReservationLabel = $derived(
		model?.otherReservers !== undefined &&
			model.kind !== 'unavailable' &&
			model.supportKind !== 'unavailable'
			? formatOtherReservationLabel(model.otherReservers)
			: null,
	);
</script>

{#if model !== null}
	<div
		class={cn(
			'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5',
			avoidTopRight && 'avoid-top-right',
			className,
		)}
		data-testid="gift-state-overlay"
	>
		<span
			class={cn(giftStateBadgeVariants({ kind: model.kind }), 'state-pill')}
			data-state-primary
			data-state-kind={model.kind}>{primaryLabel}</span
		>
		{#if model.supportKind !== undefined && supportLabel !== null}
			<span
				class={cn(giftStateBadgeVariants({ kind: model.supportKind }), 'state-pill')}
				data-reservation-support
				data-state-kind={model.supportKind}>{supportLabel}</span
			>
		{/if}
		{#if separateOtherReservationLabel !== null}
			<span
				class={cn(giftStateBadgeVariants({ kind: 'unavailable' }), 'state-pill')}
				data-other-reservation
				data-state-kind="unavailable">{separateOtherReservationLabel}</span
			>
		{/if}
	</div>
{/if}

<style>
	@container (width <= 10rem) {
		.state-pill {
			padding: 0.125rem 0.375rem;
		}

		.avoid-top-right .state-pill[data-state-kind='received'] {
			padding-inline: 0;
			letter-spacing: -0.03em;
		}
	}
</style>
