import * as m from '$lib/paraglide/messages.js';
import { getPriorityDisplay } from '$lib/modules/gifts/gift_display.js';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';

/** Fixed structural and default priority sections use shared localized copy. */
export function giftSectionLabel(section: Pick<GiftSection, 'kind' | 'label' | 'priorityKey'>) {
	switch (section.kind) {
		case GIFT_SECTION_KINDS.ownReservation:
			return m.gift_band_own_reservations();
		case GIFT_SECTION_KINDS.otherGifts:
			return m.gift_band_other_gifts();
		case GIFT_SECTION_KINDS.noPriority:
			return m.gift_priority_none();
		case GIFT_SECTION_KINDS.priorityGroup:
			return getPriorityDisplay(section.priorityKey ?? null)?.label() ?? section.label ?? '';
		case GIFT_SECTION_KINDS.uncategorized:
			return m.gift_category_uncategorized();
		case GIFT_SECTION_KINDS.received:
			return m.gift_band_received();
		default:
			return section.label ?? '';
	}
}
