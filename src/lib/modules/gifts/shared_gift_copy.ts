import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import { czechPluralCategory } from './gift_display.js';
import { giftCarriesReservationState } from './shared_gift.js';
import type { GiftByRole } from './types.js';

/**
 * Who reads a shared gift's explanation: a gifter (visitor or správce), the recipient of the shown
 * list, or a recipient of the shared gift viewing another of its lists. Recipients never read
 * anything about reservations.
 */
export const SHARED_GIFT_AUDIENCE = {
	gifter: 'gifter',
	ownRecipient: 'ownRecipient',
	otherRecipient: 'otherRecipient',
} as const;

export type SharedGiftAudience = (typeof SHARED_GIFT_AUDIENCE)[keyof typeof SHARED_GIFT_AUDIENCE];

/** Follows the server's projection: a gift without reservation state is read by its recipient. */
export function sharedGiftAudience(gift: GiftByRole, role: WishlistRole): SharedGiftAudience {
	if (role === 'recipient') {
		return SHARED_GIFT_AUDIENCE.ownRecipient;
	}
	return giftCarriesReservationState(gift)
		? SHARED_GIFT_AUDIENCE.gifter
		: SHARED_GIFT_AUDIENCE.otherRecipient;
}

/** „Anička, Petr a Eva“: every name in the nominative, never declined. */
function joinRecipientNames(names: readonly string[]): string {
	return new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(names);
}

/** The badge names two recipients and counts the rest: „Anička, Petr a 1 další“. */
export function sharedGiftBadgeNames(names: readonly string[]): string {
	if (names.length <= 2) {
		return joinRecipientNames(names);
	}
	const remainingCount = names.length - 2;
	const shownNames = names.slice(0, 2).join(', ');
	return czechPluralCategory(remainingCount) === 'other'
		? m.gift_shared_names_more_many({ names: shownNames, count: remainingCount })
		: m.gift_shared_names_more({ names: shownNames, count: remainingCount });
}

/** The explanation sentence; recipients read nothing about reserving. */
export function sharedGiftExplanationText(
	audience: SharedGiftAudience,
	participantNames: readonly string[],
	otherNames: readonly string[],
): string {
	const pair = participantNames.length <= 2;
	switch (audience) {
		case SHARED_GIFT_AUDIENCE.ownRecipient: {
			const names = joinRecipientNames(otherNames);
			return pair
				? m.gift_shared_explanation_own_pair({ names })
				: m.gift_shared_explanation_own_group({ names });
		}
		case SHARED_GIFT_AUDIENCE.otherRecipient: {
			const names = joinRecipientNames(participantNames);
			return pair
				? m.gift_shared_explanation_recipient_pair({ names })
				: m.gift_shared_explanation_recipient_group({ names });
		}
		case SHARED_GIFT_AUDIENCE.gifter: {
			const names = joinRecipientNames(participantNames);
			return pair
				? m.gift_shared_explanation_gifter_pair({ names })
				: m.gift_shared_explanation_gifter_group({ names });
		}
		default: {
			const unhandled: never = audience;
			return unhandled;
		}
	}
}

/** The quantity is always one shared total; gifters also read that it is not per recipient. */
export function sharedGiftQuantityText(
	quantity: number | null,
	participantCount: number,
	audience: SharedGiftAudience,
): string {
	const pair = participantCount <= 2;
	if (quantity === null) {
		return m.gift_shared_quantity_unlimited();
	}
	if (quantity === 1) {
		return pair ? m.gift_shared_quantity_single_pair() : m.gift_shared_quantity_single_group();
	}
	if (audience === SHARED_GIFT_AUDIENCE.gifter) {
		return pair
			? m.gift_shared_quantity_total_pair_not_each({ count: quantity })
			: m.gift_shared_quantity_total_group_not_each({ count: quantity });
	}
	return pair
		? m.gift_shared_quantity_total_pair({ count: quantity })
		: m.gift_shared_quantity_total_group({ count: quantity });
}
