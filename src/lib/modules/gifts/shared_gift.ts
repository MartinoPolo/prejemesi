import { GIFT_LINK_GROUP_KIND } from './gift_link_group_kind.js';
import type { GiftBase, GiftByRole, GiftForVisitor } from './types.js';

/** The most lists one share request adds: more than a family shares one gift between. */
export const MAX_SHARE_WISHLISTS = 10;

/** Whether the gift is one gift on wishlists of different recipients (issue #737). */
export function isSharedGift(gift: Pick<GiftBase, 'linkGroupKind'>): boolean {
	return gift.linkGroupKind === GIFT_LINK_GROUP_KIND.sharedAcrossRecipients;
}

/** Whether the gift shows as shared: a shared gift still listed on another recipient's list. */
export function showsAsSharedGift(gift: Pick<GiftBase, 'linkGroupKind' | 'sharedWith'>): boolean {
	return isSharedGift(gift) && gift.sharedWith.length > 0;
}

/**
 * Whether the server sent the gift with reservation state. A recipient of a shared gift gets its
 * recipient projection on every list, so one list's gifts can mix both shapes for one viewer.
 */
export function giftCarriesReservationState(gift: GiftByRole): gift is GiftForVisitor {
	return 'reservedCount' in gift;
}
