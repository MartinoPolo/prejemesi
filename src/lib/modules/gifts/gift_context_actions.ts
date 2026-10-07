import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import {
	RESERVATION_RELEASE_CAPABILITY,
	type ReservationReleaseCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';

export type GiftContextAction =
	| 'open'
	| 'copy'
	| 'edit'
	| 'priority'
	| 'category'
	| 'received'
	| 'multiselect'
	| 'reserve'
	| 'cancel-reservation'
	| 'purchased'
	| 'release-reservation';

export const RELEASE_RESERVATION_ACTION =
	'release-reservation' as const satisfies GiftContextAction;

/** Where the gift actions open: a gift card or list row, or the Gift viewer's footer More. */
export type GiftContextOrigin = 'card' | 'viewer';

export function hasAdditionalGiftContextActions(
	actions: readonly GiftContextAction[],
	visibleDirectActions: readonly GiftContextAction[],
): boolean {
	const directActions = new Set(visibleDirectActions);
	return actions.some((action) => !directActions.has(action));
}

export interface GiftContextActionContext {
	role: WishlistRole;
	primaryUrl: string | null;
	readOnly: boolean;
	canEdit?: boolean;
	canReserve?: boolean;
	ownsReservation?: boolean;
	canTrackPurchased?: boolean;
	releaseCapability?: ReservationReleaseCapability;
	/** Rows in the gift's release ledger, which never includes the viewer's own reservation. */
	releaseLedgerCount?: number;
	origin?: GiftContextOrigin;
}

/**
 * Whether release is offered. The Gift viewer's lane and its More overflow offer it to any release
 * reach so an overflowed release never vanishes; the card menu shortcut is for administrators only,
 * because moderators release from the gift editor.
 */
export function offersReservationRelease(input: {
	releaseCapability: ReservationReleaseCapability | undefined;
	releaseLedgerCount: number;
	origin: GiftContextOrigin;
}): boolean {
	if (input.releaseLedgerCount === 0) {
		return false;
	}
	return input.origin === 'viewer'
		? input.releaseCapability !== undefined &&
				input.releaseCapability !== RESERVATION_RELEASE_CAPABILITY.none
		: input.releaseCapability === RESERVATION_RELEASE_CAPABILITY.any;
}

/** Central capability model shared by pointer-menu and touch-sheet renderers. */
export function giftContextActions(context: GiftContextActionContext): GiftContextAction[] {
	const origin = context.origin ?? 'card';
	return [
		...linkActions(context.primaryUrl, origin),
		...managementActions(context),
		...reservationActions(context),
		...releaseActions(context, origin),
	];
}

function linkActions(primaryUrl: string | null, origin: GiftContextOrigin): GiftContextAction[] {
	// The viewer's caption already lists every link.
	return primaryUrl === null || origin === 'viewer' ? [] : ['open', 'copy'];
}

function managementActions(context: GiftContextActionContext): GiftContextAction[] {
	const manages =
		context.role === WISHLIST_ROLES.recipient || context.role === WISHLIST_ROLES.moderator;
	if (context.readOnly || !manages) {
		return [];
	}
	const editActions: GiftContextAction[] = context.canEdit === true ? ['edit'] : [];
	return [...editActions, 'priority', 'category', 'received', 'multiselect'];
}

function reservationActions(context: GiftContextActionContext): GiftContextAction[] {
	if (context.canReserve !== true) {
		return [];
	}
	if (context.ownsReservation !== true) {
		return context.readOnly ? [] : ['reserve'];
	}
	return !context.readOnly && context.canTrackPurchased === true
		? ['cancel-reservation', 'purchased']
		: ['cancel-reservation'];
}

function releaseActions(
	context: GiftContextActionContext,
	origin: GiftContextOrigin,
): GiftContextAction[] {
	const offersRelease = offersReservationRelease({
		releaseCapability: context.releaseCapability,
		releaseLedgerCount: context.releaseLedgerCount ?? 0,
		origin,
	});
	return offersRelease ? [RELEASE_RESERVATION_ACTION] : [];
}
