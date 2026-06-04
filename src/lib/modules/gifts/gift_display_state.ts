import type { GiftForVisitor, GiftByRole } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

export interface GiftDisplayState {
	isVisitorOrModerator: boolean;
	visitorGift: GiftForVisitor | null;
	isFullyReserved: boolean;
	reservedCount: number;
}

export function deriveGiftDisplayState(gift: GiftByRole, role: WishlistRole): GiftDisplayState {
	const isVisitorOrModerator = role === 'visitor' || role === 'moderator';
	const visitorGift = isVisitorOrModerator ? (gift as GiftForVisitor) : null;
	const isFullyReserved = visitorGift?.isFullyReserved ?? false;
	const reservedCount = visitorGift?.reservedCount ?? 0;
	return { isVisitorOrModerator, visitorGift, isFullyReserved, reservedCount };
}
