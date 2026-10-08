<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftOverlayEntry } from '$lib/modules/gifts/gift_display_state.js';
	import {
		formatGiftStateLabel,
		giftStateBadgeAttributes,
	} from '$lib/modules/gifts/gift_display.js';
	import { cn } from '$lib/utils.js';
	import { giftStateBadgeVariants } from './gift_state_overlay_variants.js';

	interface GiftStateListProps {
		entries: readonly GiftOverlayEntry[];
		class?: string;
		[key: `data-${string}`]: string | undefined;
	}

	let { entries, class: className, ...restProps }: GiftStateListProps = $props();
</script>

{#if entries.length > 0}
	<ul
		class={cn(
			'm-0 flex list-none flex-wrap items-start gap-(--nested-control-gap) p-0',
			className,
		)}
		role="list"
		aria-label={m.gift_state_list_label()}
		data-testid="gift-state-list"
		{...restProps}
	>
		{#each entries as entry (entry.kind)}
			<li
				class={cn(giftStateBadgeVariants({ kind: entry.kind }), 'max-w-full')}
				{...giftStateBadgeAttributes(entry)}
			>
				{formatGiftStateLabel(entry)}
			</li>
		{/each}
	</ul>
{/if}
