import { describe, it, expect } from 'vitest';
import {
	canManageWishlist,
	hidesReservationState,
	canSeeGifterIdentity,
	canSeeReserverNames,
	canReserveGift,
	canLikeGift,
	resolveRevertCapability,
	REVERT_CAPABILITY,
	type RevertCapability,
	type WishlistStatus,
} from './wishlist_capabilities.js';
import { WISHLIST_ROLES, type WishlistRole } from './types.js';

/**
 * Exhaustive rights-matrix table test for the recipient/správce capability helpers
 * (issue #99). This module is the security boundary shared by server guards and UI
 * defense-in-depth, so every role (and every role × recipientIsModerator pair for the
 * strip gate) is asserted explicitly. Expected truths are derived from
 * DECISIONS.md §"Rights matrix: recipient vs správce", NOT from the implementation:
 *
 *   - recipient  : manages the list, but NEVER sees reservations/gifter identities and
 *                  cannot reserve or like (their own surprise).
 *   - moderator  : all recipient management rights PLUS full reservation visibility
 *                  (incl. the reservation ledger) and can reserve + like.
 *   - visitor    : sees reserved state (counts only, no reserver names — issue #198)
 *                  but never the reservation ledger; can reserve + like; cannot manage.
 *   - self-promoted recipient (recipientIsModerator = true): still role `recipient`, so
 *                  the strip gate opens (sees counts) but they still do NOT see gifter
 *                  identities and still cannot reserve/like.
 */

const ALL_ROLES: readonly WishlistRole[] = [
	WISHLIST_ROLES.recipient,
	WISHLIST_ROLES.moderator,
	WISHLIST_ROLES.visitor,
];

describe('wishlist capabilities rights matrix', () => {
	describe('canManageWishlist — recipient || moderator', () => {
		const cases: ReadonlyArray<[WishlistRole, boolean]> = [
			[WISHLIST_ROLES.recipient, true],
			[WISHLIST_ROLES.moderator, true],
			[WISHLIST_ROLES.visitor, false],
		];

		it.each(cases)('role %s → %s', (role, expected) => {
			expect(canManageWishlist(role)).toBe(expected);
		});

		it('covers every role literal', () => {
			expect(cases.map(([role]) => role)).toEqual([...ALL_ROLES]);
		});
	});

	describe('canSeeGifterIdentity — moderator ONLY', () => {
		const cases: ReadonlyArray<[WishlistRole, boolean]> = [
			[WISHLIST_ROLES.recipient, false],
			[WISHLIST_ROLES.moderator, true],
			[WISHLIST_ROLES.visitor, false],
		];

		it.each(cases)('role %s → %s', (role, expected) => {
			expect(canSeeGifterIdentity(role)).toBe(expected);
		});

		it('covers every role literal', () => {
			expect(cases.map(([role]) => role)).toEqual([...ALL_ROLES]);
		});
	});

	describe('canSeeReserverNames — moderator only (issue #198)', () => {
		const cases: ReadonlyArray<[WishlistRole, boolean]> = [
			[WISHLIST_ROLES.recipient, false],
			[WISHLIST_ROLES.moderator, true],
			[WISHLIST_ROLES.visitor, false],
		];

		it.each(cases)('role %s → %s', (role, expected) => {
			expect(canSeeReserverNames(role)).toBe(expected);
		});

		it('covers every role literal', () => {
			expect(cases.map(([role]) => role)).toEqual([...ALL_ROLES]);
		});
	});

	describe('canReserveGift — everyone except recipient', () => {
		const cases: ReadonlyArray<[WishlistRole, boolean]> = [
			[WISHLIST_ROLES.recipient, false],
			[WISHLIST_ROLES.moderator, true],
			[WISHLIST_ROLES.visitor, true],
		];

		it.each(cases)('role %s → %s', (role, expected) => {
			expect(canReserveGift(role)).toBe(expected);
		});

		it('covers every role literal', () => {
			expect(cases.map(([role]) => role)).toEqual([...ALL_ROLES]);
		});
	});

	describe('canLikeGift — everyone except recipient', () => {
		const cases: ReadonlyArray<[WishlistRole, boolean]> = [
			[WISHLIST_ROLES.recipient, false],
			[WISHLIST_ROLES.moderator, true],
			[WISHLIST_ROLES.visitor, true],
		];

		it.each(cases)('role %s → %s', (role, expected) => {
			expect(canLikeGift(role)).toBe(expected);
		});

		it('covers every role literal', () => {
			expect(cases.map(([role]) => role)).toEqual([...ALL_ROLES]);
		});
	});

	describe('hidesReservationState — true only for a non-self-promoted recipient', () => {
		// Full (role × recipientIsModerator) cartesian product. Only the plain
		// recipient (recipientIsModerator = false) hides state; the self-promoted
		// recipient (true) opens the strip gate, and moderator/visitor never hide
		// regardless of the flag (the flag is meaningless for them).
		const cases: ReadonlyArray<[WishlistRole, boolean, boolean]> = [
			[WISHLIST_ROLES.recipient, false, true],
			[WISHLIST_ROLES.recipient, true, false],
			[WISHLIST_ROLES.moderator, false, false],
			[WISHLIST_ROLES.moderator, true, false],
			[WISHLIST_ROLES.visitor, false, false],
			[WISHLIST_ROLES.visitor, true, false],
		];

		it.each(cases)(
			'role %s, recipientIsModerator=%s → %s',
			(role, recipientIsModerator, expected) => {
				expect(hidesReservationState(role, recipientIsModerator)).toBe(expected);
			},
		);

		it('covers every (role × recipientIsModerator) combination', () => {
			expect(cases).toHaveLength(ALL_ROLES.length * 2);
		});
	});

	describe('self-promoted recipient sees counts but not identities and still cannot reserve/like', () => {
		it('strip gate opens but identity stays hidden', () => {
			expect(hidesReservationState(WISHLIST_ROLES.recipient, true)).toBe(false);
			expect(canSeeGifterIdentity(WISHLIST_ROLES.recipient)).toBe(false);
			expect(canSeeReserverNames(WISHLIST_ROLES.recipient)).toBe(false);
		});

		it('still cannot reserve or like their own list', () => {
			expect(canReserveGift(WISHLIST_ROLES.recipient)).toBe(false);
			expect(canLikeGift(WISHLIST_ROLES.recipient)).toBe(false);
		});
	});
});

/**
 * Revert-to-draft capability matrix (issue #150). Expected truths derive from
 * DECISIONS.md §"Revert to draft: správce when clean, admin when reserved" and
 * §"App admin via ADMIN_EMAILS", NOT from the implementation:
 *
 *   - Only an ACTIVE (shared) list can revert; draft/archived → hidden.
 *   - The RECIPIENT never sees the option (leak-safe), even when also an admin.
 *   - A správce reverts a clean list silently (`clean`); on a reserved list they are
 *     BLOCKED (`reserved-blocked`) unless they are also an admin (`reserved-admin`).
 *   - An app admin's grant is EXACTLY the reserved-list revert (`reserved-admin`),
 *     including on lists they do not manage; a clean list they don't manage → hidden.
 *   - A plain visitor (no admin) → hidden.
 */
describe('resolveRevertCapability — revert-to-draft matrix (issue #150)', () => {
	const cases: ReadonlyArray<[WishlistRole, WishlistStatus, boolean, boolean, RevertCapability]> =
		[
			// role, status, isAdmin, hasReservations → capability
			// Recipient: never, under any combination (leak guard).
			[WISHLIST_ROLES.recipient, 'active', false, false, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.recipient, 'active', false, true, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.recipient, 'active', true, true, REVERT_CAPABILITY.hidden],
			// Správce (moderator) on an active list.
			[WISHLIST_ROLES.moderator, 'active', false, false, REVERT_CAPABILITY.clean],
			[WISHLIST_ROLES.moderator, 'active', false, true, REVERT_CAPABILITY.reservedBlocked],
			[WISHLIST_ROLES.moderator, 'active', true, true, REVERT_CAPABILITY.reservedAdmin],
			[WISHLIST_ROLES.moderator, 'active', true, false, REVERT_CAPABILITY.clean],
			// Non-managing visitor: admin's grant is reserved-only; clean → hidden.
			[WISHLIST_ROLES.visitor, 'active', true, true, REVERT_CAPABILITY.reservedAdmin],
			[WISHLIST_ROLES.visitor, 'active', true, false, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.visitor, 'active', false, true, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.visitor, 'active', false, false, REVERT_CAPABILITY.hidden],
			// Non-active lists never expose the option, even to an admin with reservations.
			[WISHLIST_ROLES.moderator, 'draft', true, true, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.moderator, 'archived', true, true, REVERT_CAPABILITY.hidden],
			[WISHLIST_ROLES.visitor, 'archived', true, true, REVERT_CAPABILITY.hidden],
		];

	it.each(cases)(
		'role=%s status=%s admin=%s reserved=%s → %s',
		(role, status, isAdmin, hasReservations, expected) => {
			expect(resolveRevertCapability({ role, status, isAdmin, hasReservations })).toBe(
				expected,
			);
		},
	);
});
