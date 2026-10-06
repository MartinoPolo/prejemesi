import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

/** Menu presentation order shared by every gift action surface; also the source of the action union. */
const GIFT_CONTEXT_ACTION_GROUPS = [
	{ name: 'link', actions: ['open', 'copy'] },
	{
		name: 'gift',
		actions: ['edit', 'received', 'multiselect', 'reserve', 'cancel-reservation', 'purchased'],
	},
	{ name: 'organization', actions: ['priority', 'category'] },
] as const;

export type GiftContextAction = (typeof GIFT_CONTEXT_ACTION_GROUPS)[number]['actions'][number];

export interface GiftContextActionGroup {
	readonly name: (typeof GIFT_CONTEXT_ACTION_GROUPS)[number]['name'];
	readonly actions: readonly GiftContextAction[];
}

export function groupGiftContextActions(
	actions: readonly GiftContextAction[],
): GiftContextActionGroup[] {
	return GIFT_CONTEXT_ACTION_GROUPS.map((group) => ({
		name: group.name,
		actions: group.actions.filter((action) => actions.includes(action)),
	})).filter((group) => group.actions.length > 0);
}

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
