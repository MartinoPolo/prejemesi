<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { getContext } from 'svelte';
	import { giftSectionLabel } from './gift_section_label.js';

	interface GiftSectionHeaderProps {
		section: GiftSection;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
		/** Marks the header as part of a grouped-reorder drop target. */
		reorderGroupKey?: string;
	}

	let {
		section,
		selectionMode = false,
		onselectiontoggle,
		reorderGroupKey,
	}: GiftSectionHeaderProps = $props();
	const isSelected = getContext<((giftId: string) => boolean) | undefined>(
		'wishlist-gift-selection',
	);
	const sectionIds = $derived(section.gifts.map((gift) => gift.id));
	const selectedCount = $derived(sectionIds.filter((id) => isSelected?.(id) ?? false).length);

	const label = $derived(giftSectionLabel(section));
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
	<h2
		class="font-heading text-sm font-bold tracking-wide text-foreground uppercase [word-spacing:0.1em]"
	>
		{label}
	</h2>
	{#if selectionMode}<span class="text-xs text-muted-foreground"
			>{m.gift_selection_section_count({
				selectedCount,
				totalCount: sectionIds.length,
			})}</span
		>{/if}
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
</div>
