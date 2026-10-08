import * as m from '$lib/paraglide/messages.js';
import type { GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import {
	keyboardReorderPlacement,
	type GiftReorderPlacement,
} from '$lib/modules/gifts/gift_grouped_reorder.js';
import { giftSectionLabel } from './gift_section_label.js';

/**
 * One keyboard or button step in grouped reorder plus its screen-reader announcement. Positions
 * count within the destination group; entering another group names it.
 */
export function groupedReorderKeyboardMove(
	sections: readonly GiftSection[],
	giftId: string,
	direction: -1 | 1,
): { placement: GiftReorderPlacement; announcement: string } | null {
	const placement = keyboardReorderPlacement(sections, giftId, direction);
	const sourceSection = sections.find((section) =>
		section.gifts.some((gift) => gift.id === giftId),
	);
	const targetSection = sections.find((section) => section.key === placement?.groupKey);
	const gift = sourceSection?.gifts.find((candidate) => candidate.id === giftId);
	if (placement === null || targetSection === undefined || gift === undefined) {
		return null;
	}
	const position = placement.index + 1;
	if (sourceSection === targetSection) {
		return {
			placement,
			announcement: m.gift_reorder_move_success({
				name: gift.name,
				position,
				total: targetSection.gifts.length,
			}),
		};
	}
	return {
		placement,
		announcement: m.gift_reorder_move_group_success({
			name: gift.name,
			group: giftSectionLabel(targetSection),
			position,
			total: targetSection.gifts.length + 1,
		}),
	};
}
