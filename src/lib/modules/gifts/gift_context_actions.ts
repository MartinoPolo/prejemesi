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
	role: WishlistRole,
): boolean {
	const directActions =
		role === WISHLIST_ROLES.visitor
			? new Set<GiftContextAction>(['reserve', 'cancel-reservation'])
			: new Set<GiftContextAction>(['received']);
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
