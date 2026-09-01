<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getPriorityDisplay } from '$lib/modules/gifts/gift_display.js';
	import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { getContext } from 'svelte';

	interface GiftSectionHeaderProps {
		section: GiftSection;
		selectionMode?: boolean;
		onselectiontoggle?: (giftId: string) => void;
	}

	let { section, selectionMode = false, onselectiontoggle }: GiftSectionHeaderProps = $props();
	const isSelected = getContext<((giftId: string) => boolean) | undefined>(
		'wishlist-gift-selection',
	);
	const sectionIds = $derived(section.gifts.map((gift) => gift.id));
	const selectedCount = $derived(sectionIds.filter((id) => isSelected?.(id) ?? false).length);

	// Fixed structural and default priority sections use shared localized copy.
	const label = $derived.by(() => {
		switch (section.kind) {
			case GIFT_SECTION_KINDS.ownReservation:
				return m.gift_band_own_reservations();
			case GIFT_SECTION_KINDS.otherGifts:
				return m.gift_band_other_gifts();
			case GIFT_SECTION_KINDS.noPriority:
				return m.gift_priority_none();
			case GIFT_SECTION_KINDS.priorityGroup:
				return (
					getPriorityDisplay(section.priorityKey ?? null)?.label() ?? section.label ?? ''
				);
			case GIFT_SECTION_KINDS.uncategorized:
				return m.gift_category_uncategorized();
			case GIFT_SECTION_KINDS.received:
				return m.gift_band_received();
			default:
				return section.label ?? '';
		}
	});
</script>

<div class="flex items-center gap-2 pt-1 pb-0.5">
	{#if selectionMode}
		<span class="grid w-7 shrink-0 place-items-center">
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
