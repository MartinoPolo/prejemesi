<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftOverlayEntry } from '$lib/modules/gifts/gift_display_state.js';
	import { formatOtherReservationLabel } from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';
	import { giftStateBadgeVariants } from './gift_state_overlay_variants.js';

	interface GiftStateOverlayProps {
		entries: readonly GiftOverlayEntry[];
		/** Compact labels only when a narrow containing image also has a top-right control. */
		avoidTopRight?: boolean;
		class?: string;
	}

	let { entries, avoidTopRight = false, class: className }: GiftStateOverlayProps = $props();

	function label(entry: GiftOverlayEntry): string {
		switch (entry.kind) {
			case 'received':
				return m.gift_received_badge();
			case 'own-reservation':
				return m.gift_reserved_by_me_overlay();
			case 'own-purchased':
				return m.gift_bought();
			case 'unavailable':
				return formatOtherReservationLabel(entry.otherReservers);
			case 'partial':
				return m.gift_remaining_capacity({
					remaining: entry.remaining,
					total: entry.total,
				});
		}
	}
</script>

{#if entries.length > 0}
	<div
		class={cn(
			'pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5',
			avoidTopRight && 'avoid-top-right',
			className,
		)}
		data-testid="gift-state-overlay"
	>
		{#each entries as entry, index (index)}
			<span
				class={cn(giftStateBadgeVariants({ kind: entry.kind }), 'state-pill')}
				data-state-primary={entry.role === 'primary' ? '' : undefined}
				data-reservation-support={entry.role === 'support' ? '' : undefined}
				data-other-reservation={entry.role === 'other-reservation' ? '' : undefined}
				data-state-kind={entry.kind}>{label(entry)}</span
			>
		{/each}
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
