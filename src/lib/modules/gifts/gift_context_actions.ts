import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

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
	| 'purchased';

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
}

/** Central capability model shared by pointer-menu and touch-sheet renderers. */
export function giftContextActions(context: GiftContextActionContext): GiftContextAction[] {
	const actions: GiftContextAction[] = context.primaryUrl === null ? [] : ['open', 'copy'];
	const manages =
		context.role === WISHLIST_ROLES.recipient || context.role === WISHLIST_ROLES.moderator;

	if (!context.readOnly && manages) {
		if (context.canEdit === true) {
			actions.push('edit');
		}
		actions.push('priority', 'category', 'received', 'multiselect');
	}

	if (context.canReserve === true) {
		if (context.ownsReservation === true) {
			actions.push('cancel-reservation');
			if (!context.readOnly && context.canTrackPurchased === true) {
				actions.push('purchased');
			}
		} else if (!context.readOnly) {
			actions.push('reserve');
		}
	}

	return actions;
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
