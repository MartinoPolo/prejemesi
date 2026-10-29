import { WISHLIST_KIND, type WishlistKind } from '$lib/modules/wishlists/types.js';

/**
 * A gift follows the strict post-share rules (name freeze, append-only description, raise-only
 * quantity, deletion grace) unless its wishlist is permanent and nobody has reserved it. Shared by
 * the server rules and the gift editor, which treats a reservation it cannot see as absent and
 * leaves the server to reject the edit.
 */
export function giftFollowsStrictPostShareRules(
	wishlistKind: WishlistKind,
	hasActiveReservation: boolean,
): boolean {
	return wishlistKind !== WISHLIST_KIND.permanent || hasActiveReservation;
}
