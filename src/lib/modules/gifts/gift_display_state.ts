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
	const visitorGift = isVisitorOrModerator ? gift : null;
	const isFullyReserved = visitorGift?.isFullyReserved ?? false;
	const reservedCount = visitorGift?.reservedCount ?? 0;
	const quantity = visitorGift?.quantity;
	const remaining = quantity == null ? undefined : Math.max(0, quantity - reservedCount);
	const reservationKind: Exclude<GiftOverlayKind, 'received'> | null =
		visitorGift?.myReservationId != null
			? 'own-reservation'
			: isFullyReserved
				? 'unavailable'
				: quantity != null && reservedCount > 0 && remaining! > 0
					? 'partial'
					: null;
	const overlay: GiftStateOverlayModel | null = gift.received
		? {
				kind: 'received',
				...(reservationKind === null ? {} : { supportKind: reservationKind }),
				...(reservationKind === 'partial' ? { remaining, total: quantity! } : {}),
			}
		: reservationKind === null
			? null
			: {
					kind: reservationKind,
					...(reservationKind === 'partial' ? { remaining, total: quantity! } : {}),
					...(reservationKind === 'own-reservation' &&
					remaining !== undefined &&
					remaining > 0
						? { supportKind: 'partial' as const, remaining, total: quantity! }
						: {}),
				};
	const isArchived = capabilities.isArchived ?? false;
	return {
		isVisitorOrModerator,
		visitorGift,
		isFullyReserved,
		reservedCount,
		presentation: {
			overlay,
			isDimmed: !hidePresentationState && (gift.received || isFullyReserved),
			showLike: capabilities.canLike && !isArchived,
		},
	};
}
