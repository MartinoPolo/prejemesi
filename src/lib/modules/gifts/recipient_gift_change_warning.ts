import {
	WISHLIST_KIND,
	WISHLIST_ROLES,
	type Wishlist,
	type WishlistRole,
} from '$lib/modules/wishlists/types.js';

const ACKNOWLEDGEMENT_KEY_PREFIX = 'recipient-gift-change-warning:';

/**
 * On a shared permanent wishlist the recipient cannot see reservations, yet a reserved gift keeps
 * the strict post-share rules, so a rejected edit or deletion would reveal the reservation. The
 * recipient is warned before their first gift change on that wishlist until they acknowledge it.
 */
export function shouldWarnRecipientBeforeGiftChange(input: {
	wishlist: Pick<Wishlist, 'kind' | 'sharedAt' | 'status'>;
	role: WishlistRole;
	acknowledged: boolean;
}): boolean {
	return (
		input.role === WISHLIST_ROLES.recipient &&
		input.wishlist.kind === WISHLIST_KIND.permanent &&
		input.wishlist.sharedAt !== null &&
		input.wishlist.status !== 'archived' &&
		!input.acknowledged
	);
}

/** Whether the warning was acknowledged for this wishlist in the current browser session. */
export function readRecipientGiftChangeWarningAcknowledged(wishlistId: string): boolean {
	try {
		return (
			(globalThis.sessionStorage?.getItem(ACKNOWLEDGEMENT_KEY_PREFIX + wishlistId) ??
				null) !== null
		);
	} catch {
		return false;
	}
}

export function storeRecipientGiftChangeWarningAcknowledged(wishlistId: string): void {
	try {
		globalThis.sessionStorage?.setItem(ACKNOWLEDGEMENT_KEY_PREFIX + wishlistId, '1');
	} catch {
		// Storage can be unavailable (privacy mode, quota); the warning then simply returns.
	}
}
