<script lang="ts">
	import type { GiftOverlayEntry } from '$lib/modules/gifts/gift_display_state.js';
	import {
		formatGiftStateLabel,
		giftStateBadgeAttributes,
	} from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';
	import { giftStateBadgeVariants } from './gift_state_overlay_variants.js';

	interface GiftStateOverlayProps {
		entries: readonly GiftOverlayEntry[];
		/** Compact labels only when a narrow containing image also has a top-right control. */
		avoidTopRight?: boolean;
		class?: string;
	}

	let { entries, avoidTopRight = false, class: className }: GiftStateOverlayProps = $props();
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
				{...giftStateBadgeAttributes(entry)}>{formatGiftStateLabel(entry)}</span
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
