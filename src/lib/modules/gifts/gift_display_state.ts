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

export interface GiftDisplayCapabilities {
	canLike: boolean;
	isArchived?: boolean;
}

export type GiftOverlayKind = 'received' | 'own-reservation' | 'unavailable' | 'partial';

export interface GiftStateOverlayModel {
	kind: GiftOverlayKind;
	supportKind?: Exclude<GiftOverlayKind, 'received'>;
	remaining?: number;
	total?: number;
}

export interface GiftPresentation {
	overlay: GiftStateOverlayModel | null;
	isDimmed: boolean;
	showLike: boolean;
}

export interface GiftDisplayState {
	isVisitorOrModerator: boolean;
	visitorGift: GiftForVisitor | null;
	reservationAwareGift: GiftForVisitor | null;
	isFullyReserved: boolean;
	reservedCount: number;
	presentation: GiftPresentation;
}

const noPresentationCapabilities: GiftDisplayCapabilities = {
	canLike: false,
};

export function deriveGiftDisplayState(
	gift: GiftByRole,
	role: WishlistRole,
	hideReservationState = false,
	capabilities: GiftDisplayCapabilities = noPresentationCapabilities,
	hidePresentationState = false,
): GiftDisplayState {
	const isVisitorOrModerator = isGiftForVisitor(gift, role, hideReservationState);
	const reservationAwareGift =
		!hideReservationState && 'reservedCount' in gift
			? role === 'recipient'
				? {
						...gift,
						reserverNames: [],
						myReservationId: null,
						myReservationPurchasedAt: null,
					}
				: gift
			: null;
	const visitorGift = isVisitorOrModerator ? reservationAwareGift : null;
	const isFullyReserved = reservationAwareGift?.isFullyReserved ?? false;
	const reservedCount = reservationAwareGift?.reservedCount ?? 0;
	const quantity = reservationAwareGift?.quantity;
	const remaining = quantity == null ? undefined : Math.max(0, quantity - reservedCount);
	const reservationKind: Exclude<GiftOverlayKind, 'received'> | null =
		reservationAwareGift?.myReservationId != null
			? 'own-reservation'
			: isFullyReserved
				? 'unavailable'
				: quantity != null && reservedCount > 0 && remaining! > 0
					? 'partial'
					: null;
	const reservationPill =
		reservationKind === null
			? {}
			: {
					supportKind: reservationKind,
					...(reservationKind === 'partial' ? { remaining, total: quantity! } : {}),
				};
	const overlay: GiftStateOverlayModel | null = gift.received
		? {
				kind: 'received',
				...reservationPill,
			}
		: reservationKind === null
			? null
			: {
					kind: reservationKind,
					...(reservationKind === 'partial' ? { remaining, total: quantity! } : {}),
				};
	const isArchived = capabilities.isArchived ?? false;
	return {
		isVisitorOrModerator,
		visitorGift,
		reservationAwareGift,
		isFullyReserved,
		reservedCount,
		presentation: {
			overlay,
			isDimmed: !hidePresentationState && (gift.received || isFullyReserved),
			showLike: capabilities.canLike && !isArchived,
		},
	};
}
