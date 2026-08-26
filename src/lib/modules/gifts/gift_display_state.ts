import type { GiftForVisitor, GiftByRole } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

export function isGiftForVisitor(
	gift: GiftByRole,
	role: WishlistRole,
	hideReservationState = false,
): gift is GiftForVisitor {
	return (
		!hideReservationState &&
		(role === 'visitor' || role === 'moderator') &&
		'reservedCount' in gift
	);
}

export interface GiftDisplayState {
	isVisitorOrModerator: boolean;
	visitorGift: GiftForVisitor | null;
	isFullyReserved: boolean;
	reservedCount: number;
}

export function deriveGiftDisplayState(
	gift: GiftByRole,
	role: WishlistRole,
	hideReservationState = false,
): GiftDisplayState {
	const isVisitorOrModerator = isGiftForVisitor(gift, role, hideReservationState);
	const visitorGift = isVisitorOrModerator ? gift : null;
	const isFullyReserved = visitorGift?.isFullyReserved ?? false;
	const reservedCount = visitorGift?.reservedCount ?? 0;
	return { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount };
}
