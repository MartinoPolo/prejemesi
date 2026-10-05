import type { GiftForVisitor, GiftByRole } from './types.js';
import type { GiftContextAction } from './gift_context_actions.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import {
	canManageWishlist,
	canSeeReserverNames,
} from '$lib/modules/wishlists/wishlist_capabilities.js';

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

/** Who else holds a reservation; several reservers are summarised rather than listed. */
export type OtherReserverIdentity = { kind: 'single'; name: string } | { kind: 'multiple' };

type GiftOverlayState =
	| { kind: 'received' | 'own-reservation' | 'own-purchased' }
	/** `otherReservers` is present only for viewers allowed to see names, never naming the viewer. */
	| { kind: 'unavailable'; otherReservers?: OtherReserverIdentity }
	| { kind: 'partial'; remaining: number; total: number };

export type GiftOverlayKind = GiftOverlayState['kind'];

/** Where a badge sits in the overlay group: the leading state, its support, or another reserver. */
export type GiftOverlayEntryRole = 'primary' | 'support' | 'other-reservation';

export type GiftOverlayEntry = GiftOverlayState & { role: GiftOverlayEntryRole };

export interface GiftPresentation {
	/** Ordered state badges; empty when the gift shows no state. */
	overlay: readonly GiftOverlayEntry[];
	otherReservers: OtherReserverIdentity | undefined;
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
): OtherReserverIdentity | undefined {
	const otherReserverCount = reserverNames.length - (ownsReservation ? 1 : 0);
	if (otherReserverCount <= 0) {
		return undefined;
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
	const otherReservers = otherReserverIdentity(
		canSeeReserverNames(role) ? (reservationAwareGift?.reserverNames ?? []) : [],
		ownsReservation,
	);
	const reservationState: GiftOverlayState | null = ownsReservation
		? {
				kind:
					reservationAwareGift?.myReservationPurchasedAt != null
						? 'own-purchased'
						: 'own-reservation',
			}
		: isFullyReserved
			? otherReservers === undefined
				? { kind: 'unavailable' }
				: { kind: 'unavailable', otherReservers }
			: quantity != null && reservedCount > 0 && remaining! > 0
				? { kind: 'partial', remaining: remaining!, total: quantity }
				: null;
	const remainingCapacityState: GiftOverlayState | null =
		ownsReservation && remaining !== undefined && remaining > 0
			? { kind: 'partial', remaining, total: quantity! }
			: null;
	const overlayStates = (
		gift.received
			? [{ kind: 'received' } as const, reservationState]
			: [reservationState, reservationState === null ? null : remainingCapacityState]
	).filter((state) => state !== null);
	const overlay: GiftOverlayEntry[] = overlayStates.map((state, index) => ({
		...state,
		role: index === 0 ? 'primary' : 'support',
	}));
	// Authorized identity joins the group as its own badge when no state badge already names it.
	if (
		overlay.length > 0 &&
		otherReservers !== undefined &&
		reservationState?.kind !== 'unavailable'
	) {
		overlay.push({ kind: 'unavailable', otherReservers, role: 'other-reservation' });
	}
	const isArchived = capabilities.isArchived ?? false;
	return {
		isVisitorOrModerator,
		visitorGift,
		reservationAwareGift,
		isFullyReserved,
		reservedCount,
		presentation: {
			overlay,
			otherReservers,
			isDimmed: !hidePresentationState && (gift.received || isFullyReserved),
			showLike: capabilities.canLike && !isArchived,
		},
	};
}

export interface PurchaseTrackingContext {
	isAuthenticated: boolean;
	isArchived: boolean;
	ownsReservation: boolean;
}

/**
 * Bought is gifter-private self-tracking: only a signed-in holder of a reservation on an active
 * list may toggle it. Every Bought surface shares this gate so none renders an empty slot.
 */
export function canTrackPurchase(context: Readonly<PurchaseTrackingContext>): boolean {
	return context.isAuthenticated && !context.isArchived && context.ownsReservation;
}

export interface GiftBrowseActionInput {
	role: WishlistRole;
	/** Present only for visitors and moderators allowed to reserve. */
	visitorGift: GiftForVisitor | null;
	isFullyReserved: boolean;
	isArchived: boolean;
	isAuthenticated: boolean;
	contextualMode: boolean;
	canMarkReceived: boolean;
}

export interface GiftBrowseActions {
	primaryAction: 'reserve' | 'cancel-reservation' | 'received' | undefined;
	/** Ordered left to right beside the primary action. */
	secondaryActions: readonly GiftContextAction[];
}

/**
 * Direct actions on a browse card or list row. A reservation command is primary whenever it
 * exists; a manager's Received then joins the secondary actions, after the viewer's own Bought.
 */
export function deriveGiftBrowseActions(input: Readonly<GiftBrowseActionInput>): GiftBrowseActions {
	const { visitorGift } = input;
	const ownsReservation = visitorGift !== null && visitorGift.myReservationId !== null;
	const reservationAction =
		visitorGift === null
			? undefined
			: ownsReservation
				? 'cancel-reservation'
				: !input.isArchived && !input.isFullyReserved
					? 'reserve'
					: undefined;
	const hasReceivedAction =
		canManageWishlist(input.role) &&
		!input.contextualMode &&
		!input.isArchived &&
		input.canMarkReceived;
	const hasPurchasedAction = canTrackPurchase({
		isAuthenticated: input.isAuthenticated,
		isArchived: input.isArchived,
		ownsReservation,
	});

	return {
		primaryAction: reservationAction ?? (hasReceivedAction ? 'received' : undefined),
		secondaryActions: [
			...(hasPurchasedAction ? (['purchased'] as const) : []),
			...(reservationAction !== undefined && hasReceivedAction
				? (['received'] as const)
				: []),
		],
	};
}
