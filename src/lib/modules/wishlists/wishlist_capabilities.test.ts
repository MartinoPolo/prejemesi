import { describe, it, expect } from 'vitest';
import {
	canManageWishlist,
	hidesReservationState,
	canSeeGifterIdentity,
	canReserveGift,
	canLikeGift,
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
 *                  (incl. gifter identities) and can reserve + like.
 *   - visitor    : sees reserved state but never gifter identity; can reserve + like;
 *                  cannot manage.
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
		});

		it('still cannot reserve or like their own list', () => {
			expect(canReserveGift(WISHLIST_ROLES.recipient)).toBe(false);
			expect(canLikeGift(WISHLIST_ROLES.recipient)).toBe(false);
		});
	});
});
