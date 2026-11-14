<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { getContext } from 'svelte';
	import { giftSectionLabel } from './gift_section_label.js';
	import { formatGiftCount } from '$lib/modules/gifts/gift_display.js';

	interface GiftSectionHeaderProps {
		section: GiftSection;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		/** Marks the header as part of a grouped-reorder drop target. */
		reorderGroupKey?: string;
		/** Gifts in the row the header introduces, shown after the label. */
		count?: number;
		/** Visible card range of the row, shown at the end of the line; sighted-only. */
		position?: string;
		/** Id that makes the heading an in-page jump target. */
		jumpTargetId?: string;
	}

	let {
		section,
		selectionMode = false,
		onselectiontoggle,
		reorderGroupKey,
		count,
		position,
		jumpTargetId,
	}: GiftSectionHeaderProps = $props();
	const isSelected = getContext<((giftId: string) => boolean) | undefined>(
		'wishlist-gift-selection',
	);
	const sectionIds = $derived(section.gifts.map((gift) => gift.id));
	const selectedCount = $derived(sectionIds.filter((id) => isSelected?.(id) ?? false).length);

	const label = $derived(giftSectionLabel(section));
	// Focusable only by script, so a jump can land on it without adding a tab stop.
	const jumpTargetAttributes = $derived(
		jumpTargetId === undefined ? {} : { id: jumpTargetId, tabindex: -1 },
	);
</script>

<div class="flex items-center gap-2 pt-1 pb-0.5" data-gift-reorder-group={reorderGroupKey}>
	{#if selectionMode}
		<span class="inline-flex shrink-0">
			<Checkbox
				checked={selectedCount === sectionIds.length && sectionIds.length > 0}
				indeterminate={selectedCount > 0 && selectedCount < sectionIds.length}
				onCheckedChange={(checked) => {
					for (const giftId of sectionIds) {
						if ((isSelected?.(giftId) ?? false) !== checked) {
							onselectiontoggle?.(giftId);
						}
					}
				}}
				aria-label={label}
			/>
		</span>
	{/if}
	<!-- The plate only paints over a wishlist theme backdrop, keeping text off the artwork. -->
	<span class="wishlist-backdrop-plate inline-flex min-w-0 items-center gap-2">
		{#if label !== ''}
			<h2
				{...jumpTargetAttributes}
				class={[
					'font-heading text-sm font-bold tracking-wide text-foreground uppercase [word-spacing:0.1em]',
					jumpTargetId !== undefined &&
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
				]}
			>
				{label}
			</h2>
		{/if}
		{#if count !== undefined}
			<span
				class="text-sm font-semibold whitespace-nowrap text-muted-foreground"
				data-testid="gift-section-count">{formatGiftCount(count)}</span
			>
		{/if}
		{#if selectionMode}<span class="text-xs text-muted-foreground"
				>{m.gift_selection_section_count({
					selectedCount,
					totalCount: sectionIds.length,
				})}</span
			>{/if}
	</span>
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
	{#if position}
		<span
			class="wishlist-backdrop-plate text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
			aria-hidden="true"
			data-testid="gift-section-position">{position}</span
		>
	{/if}
</div>
