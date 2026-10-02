import type { GiftForVisitor, GiftByRole } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import { canSeeReserverNames } from '$lib/modules/wishlists/wishlist_capabilities.js';

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

export type GiftOverlayKind =
	| 'received'
	| 'own-reservation'
	| 'own-purchased'
	| 'unavailable'
	| 'partial';

/** Who else holds a reservation; several reservers are summarised rather than listed. */
export type OtherReserverIdentity = { kind: 'single'; name: string } | { kind: 'multiple' };

export interface GiftStateOverlayModel {
	kind: GiftOverlayKind;
	supportKind?: Exclude<GiftOverlayKind, 'received'>;
	remaining?: number;
	total?: number;
	/** Present only for viewers allowed to see reserver names, never naming the viewer. */
	otherReservers?: OtherReserverIdentity;
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

/**
 * Reserver names include the viewer's own reservation without marking which one it is, so a
 * viewer holding a reservation is only told that several people reserved when others did too.
 */
function otherReserverIdentity(
	reserverNames: readonly string[],
	ownsReservation: boolean,
): OtherReserverIdentity | null {
	const otherReserverCount = reserverNames.length - (ownsReservation ? 1 : 0);
	if (otherReserverCount <= 0) {
		return null;
	}
	const [onlyReserverName] = reserverNames;
	return reserverNames.length === 1 && onlyReserverName !== undefined
		? { kind: 'single', name: onlyReserverName }
		: { kind: 'multiple' };
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
	const ownsReservation = reservationAwareGift?.myReservationId != null;
	const reservationKind: Exclude<GiftOverlayKind, 'received'> | null = ownsReservation
		? reservationAwareGift?.myReservationPurchasedAt != null
			? 'own-purchased'
			: 'own-reservation'
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
	const remainingCapacityPill =
		ownsReservation && remaining !== undefined && remaining > 0
			? { supportKind: 'partial' as const, remaining, total: quantity! }
			: {};
	const otherReservers = otherReserverIdentity(
		canSeeReserverNames(role) ? (reservationAwareGift?.reserverNames ?? []) : [],
		ownsReservation,
	);
	const otherReserversPill = otherReservers === null ? {} : { otherReservers };
	const overlay: GiftStateOverlayModel | null = gift.received
		? {
				kind: 'received',
				...reservationPill,
				...otherReserversPill,
			}
		: reservationKind === null
			? null
			: {
					kind: reservationKind,
					...(reservationKind === 'partial' ? { remaining, total: quantity! } : {}),
					...remainingCapacityPill,
					...otherReserversPill,
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
