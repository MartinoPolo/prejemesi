import { describe, expect, it } from 'vitest';
import { WISHLIST_KIND } from '$lib/modules/wishlists/types.js';
import { giftFollowsStrictPostShareRules } from './gift_strict_post_share_rules.js';

describe('giftFollowsStrictPostShareRules', () => {
	it('keeps every gift on an occasion wishlist strict', () => {
		expect(giftFollowsStrictPostShareRules(WISHLIST_KIND.occasion, false)).toBe(true);
		expect(giftFollowsStrictPostShareRules(WISHLIST_KIND.occasion, true)).toBe(true);
	});

	it('relaxes only unreserved gifts on a permanent wishlist', () => {
		expect(giftFollowsStrictPostShareRules(WISHLIST_KIND.permanent, false)).toBe(false);
		expect(giftFollowsStrictPostShareRules(WISHLIST_KIND.permanent, true)).toBe(true);
	});
});
