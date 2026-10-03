import type { GiftForVisitor } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';
import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
import { canTrackPurchase, type GiftContextAction } from './gift_context_actions.js';

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
