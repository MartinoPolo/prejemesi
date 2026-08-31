import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';

export type GiftContextAction =
	| 'open'
	| 'copy'
	| 'edit'
	| 'priority'
	| 'category'
	| 'received'
	| 'multiselect';

export interface GiftContextActionContext {
	role: WishlistRole;
	primaryUrl: string | null;
	readOnly: boolean;
	canEdit?: boolean;
}

/** Central capability model shared by pointer-menu and touch-sheet renderers. */
export function giftContextActions(context: GiftContextActionContext): GiftContextAction[] {
	const actions: GiftContextAction[] = context.primaryUrl === null ? [] : ['open', 'copy'];
	const manages =
		context.role === WISHLIST_ROLES.recipient || context.role === WISHLIST_ROLES.moderator;
	if (!manages || context.readOnly) {
		return actions;
	}

	if (context.canEdit === true) {
		actions.push('edit');
	}
	actions.push('priority', 'category', 'received', 'multiselect');
	return actions;
}
