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
 * Whether the caller may see the full reservation ledger and act on it (per-reservation
 * details, cancelling anonymous reservations on someone's behalf). Moderators only.
 * For the per-gift display line, see {@link canSeeReserverNames} (same moderator-only rule).
 */
export function canSeeGifterIdentity(role: WishlistRole): boolean {
	return role === WISHLIST_ROLES.moderator;
}

/**
 * Whether the caller may see reserver display names on gifts (e.g. "rezervoval(a) Babička").
 * Moderator-only (issue #198, supersedes issue #102 REQ-14 which showed names to all
 * non-recipients): reserver identity is personal data and belongs to gifter identity, not
 * general reservation state. Visitors see only the anonymous reserved state (counts, no
 * names); the recipient sees nothing, as always.
 */
export function canSeeReserverNames(role: WishlistRole): boolean {
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

/** Wishlist lifecycle status — client-safe mirror of the DB `wishlist_status` enum. */
export type WishlistStatus = 'draft' | 'active' | 'archived';

/**
 * The revert-to-draft affordance for a viewer (issue #150, decision 2026-07-14). Single source of
 * truth so the admin check never scatters across endpoints: both the settings UI and the server
 * command (`revertWishlistToDraft`) switch on this. Pure and client-safe — the caller supplies the
 * server-resolved `isAdmin` (from `isAppAdmin`) and `hasReservations`.
 *
 * - `hidden`: no revert option — the recipient (leak-safe: seeing which variant renders would tell
 *   them whether reservations exist on their own list), a plain visitor, a non-active list, or an
 *   admin on a clean list they do not manage (clean revert is a správce action, not an admin grant).
 * - `clean`: silent revert allowed — a správce on a reservation-free active list.
 * - `reserved-admin`: revert allowed but cancels all reservations + notifies reservers — app admin only.
 * - `reserved-blocked`: a non-admin správce on a reserved list — shown DISABLED with the „jen
 *   administrátor" copy (they can see the reservations, so the disabled variant leaks nothing).
 */
export const REVERT_CAPABILITY = {
	hidden: 'hidden',
	clean: 'clean',
	reservedAdmin: 'reserved-admin',
	reservedBlocked: 'reserved-blocked',
} as const;

export type RevertCapability = (typeof REVERT_CAPABILITY)[keyof typeof REVERT_CAPABILITY];

export function resolveRevertCapability(input: {
	role: WishlistRole;
	status: WishlistStatus;
	isAdmin: boolean;
	hasReservations: boolean;
}): RevertCapability {
	// Only an active (shared) list can revert; draft/archived expose nothing here.
	if (input.status !== 'active') {
		return REVERT_CAPABILITY.hidden;
	}
	// The recipient NEVER sees the revert option — even when they are also an admin. This is the
	// core leak guard: the rendered variant would otherwise disclose whether reservations exist.
	if (input.role === WISHLIST_ROLES.recipient) {
		return REVERT_CAPABILITY.hidden;
	}
	if (input.role === WISHLIST_ROLES.moderator) {
		if (!input.hasReservations) {
			return REVERT_CAPABILITY.clean;
		}
		return input.isAdmin ? REVERT_CAPABILITY.reservedAdmin : REVERT_CAPABILITY.reservedBlocked;
	}
	// Non-manager (visitor). An admin's grant is EXACTLY the reserved-list revert; a clean list is
	// a správce action, so a non-managing admin sees nothing on it.
	if (input.isAdmin && input.hasReservations) {
		return REVERT_CAPABILITY.reservedAdmin;
	}
	return REVERT_CAPABILITY.hidden;
}
