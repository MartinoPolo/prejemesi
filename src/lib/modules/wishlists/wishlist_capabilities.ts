import { WISHLIST_ROLES, type WishlistRole } from './types.js';

/**
 * Pure, client-safe capability predicates — the single source of truth for the
 * recipient/správce rights matrix (issue #99). Consumed by server guards
 * (`wishlist_access.ts`) as the security boundary AND by UI components as
 * defense-in-depth. No DB or server imports, so both sides share one definition.
 *
 * Core invariant (re-keyed from the old owner model): the RECIPIENT never sees
 * reservation state and cannot reserve/like their own list. Everyone with a
 * `moderator` role sees full state everywhere.
 */

/** Full management rights: add/edit gifts, metadata/theme/image, share, archive, delete, manage správci, mark received. */
export function canManageWishlist(role: WishlistRole): boolean {
	return role === WISHLIST_ROLES.recipient || role === WISHLIST_ROLES.moderator;
}

/**
 * Whether reservation/like data must be WITHHELD from the caller. True only for a
 * linked recipient who has not self-promoted; false for moderators, visitors, and
 * self-promoted recipients (who see counts). This is the API strip gate.
 */
export function hidesReservationState(role: WishlistRole, recipientIsModerator: boolean): boolean {
	return role === WISHLIST_ROLES.recipient && !recipientIsModerator;
}

/**
 * Whether the caller may see gifter identities (reserver names). Moderators only —
 * a self-promoted recipient sees counts but never who reserved what.
 */
export function canSeeGifterIdentity(role: WishlistRole): boolean {
	return role === WISHLIST_ROLES.moderator;
}

/** Whether the caller may reserve gifts. Everyone except the recipient (their own surprise). */
export function canReserveGift(role: WishlistRole): boolean {
	return role !== WISHLIST_ROLES.recipient;
}

/** Whether the caller may like gifts. Everyone except the recipient. */
export function canLikeGift(role: WishlistRole): boolean {
	return role !== WISHLIST_ROLES.recipient;
}
