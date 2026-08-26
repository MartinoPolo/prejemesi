<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';

	interface GiftSectionHeaderProps {
		section: GiftSection;
	}

	let { section }: GiftSectionHeaderProps = $props();

	// Header copy in the sticker design language (issue #224): own-reservation and „Bez priority"
	// are fixed messages; a priority group carries its level's own label.
	const label = $derived.by(() => {
		switch (section.kind) {
			case GIFT_SECTION_KINDS.ownReservation:
				return m.gift_band_own_reservations();
			case GIFT_SECTION_KINDS.otherGifts:
				return m.gift_band_other_gifts();
			case GIFT_SECTION_KINDS.noPriority:
				return m.gift_priority_none();
			case GIFT_SECTION_KINDS.received:
				return m.gift_band_received();
			default:
				return section.label ?? '';
		}
	});
</script>

<div class="flex items-center gap-2 pt-1 pb-0.5">
	<h2
		class="font-heading text-sm font-bold tracking-wide text-foreground uppercase [word-spacing:0.1em]"
	>
		{label}
	</h2>
	<span class="h-px flex-1 bg-border" aria-hidden="true"></span>
</div>
