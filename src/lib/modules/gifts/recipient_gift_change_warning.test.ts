import { afterEach, describe, expect, it, vi } from 'vitest';
import { WISHLIST_KIND, WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	readRecipientGiftChangeWarningAcknowledged,
	shouldWarnRecipientBeforeGiftChange,
	storeRecipientGiftChangeWarningAcknowledged,
} from './recipient_gift_change_warning.js';

const sharedPermanentWishlist = {
	kind: WISHLIST_KIND.permanent,
	sharedAt: new Date('2026-10-01T10:00:00Z'),
	status: 'active' as const,
};

describe('shouldWarnRecipientBeforeGiftChange', () => {
	it('warns the recipient of a shared permanent wishlist until they acknowledge it', () => {
		expect(
			shouldWarnRecipientBeforeGiftChange({
				wishlist: sharedPermanentWishlist,
				role: WISHLIST_ROLES.recipient,
				acknowledged: false,
			}),
		).toBe(true);
		expect(
			shouldWarnRecipientBeforeGiftChange({
				wishlist: sharedPermanentWishlist,
				role: WISHLIST_ROLES.recipient,
				acknowledged: true,
			}),
		).toBe(false);
	});

	it.each([WISHLIST_ROLES.moderator, WISHLIST_ROLES.visitor])(
		'never warns a non-recipient (%s)',
		(role) => {
			expect(
				shouldWarnRecipientBeforeGiftChange({
					wishlist: sharedPermanentWishlist,
					role,
					acknowledged: false,
				}),
			).toBe(false);
		},
	);

	it('never warns on an unshared, occasion or archived wishlist', () => {
		for (const wishlist of [
			{ ...sharedPermanentWishlist, sharedAt: null },
			{ ...sharedPermanentWishlist, kind: WISHLIST_KIND.occasion },
			{ ...sharedPermanentWishlist, status: 'archived' as const },
		]) {
			expect(
				shouldWarnRecipientBeforeGiftChange({
					wishlist,
					role: WISHLIST_ROLES.recipient,
					acknowledged: false,
				}),
			).toBe(false);
		}
	});
});

describe('recipient gift change warning acknowledgement', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('remembers the acknowledgement per wishlist for the browser session', () => {
		const entries = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => entries.get(key) ?? null,
			setItem: (key: string, value: string) => entries.set(key, value),
		});

		expect(readRecipientGiftChangeWarningAcknowledged('wishlist-a')).toBe(false);
		storeRecipientGiftChangeWarningAcknowledged('wishlist-a');
		expect(readRecipientGiftChangeWarningAcknowledged('wishlist-a')).toBe(true);
		expect(readRecipientGiftChangeWarningAcknowledged('wishlist-b')).toBe(false);
	});

	it('treats missing or failing storage as not acknowledged without throwing', () => {
		vi.stubGlobal('sessionStorage', undefined);
		expect(readRecipientGiftChangeWarningAcknowledged('wishlist-a')).toBe(false);
		expect(() => storeRecipientGiftChangeWarningAcknowledged('wishlist-a')).not.toThrow();

		vi.stubGlobal('sessionStorage', {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
		});
		expect(readRecipientGiftChangeWarningAcknowledged('wishlist-a')).toBe(false);
		expect(() => storeRecipientGiftChangeWarningAcknowledged('wishlist-a')).not.toThrow();
	});
});
