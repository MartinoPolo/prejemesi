import { describe, expect, it } from 'vitest';
import {
	addToNewGiftDigestPayload,
	getNewGiftDigestDisplay,
	parseNewGiftDigestPayload,
} from './new_gift_digest.js';

describe('new gift digest payload', () => {
	it('coalesces multiple wishlists into one bounded count payload', () => {
		let payload = addToNewGiftDigestPayload(null, {
			wishlistId: 'a',
			shortId: 'christmas',
			title: 'Christmas',
			giftNames: ['Camera', 'Book'],
		});
		payload = addToNewGiftDigestPayload(payload, {
			wishlistId: 'b',
			shortId: 'birthday',
			title: 'Birthday',
			giftNames: ['Bike'],
		});
		expect(payload.totalCount).toBe(3);
		expect(payload.wishlists.map((item) => item.count)).toEqual([2, 1]);
		expect(parseNewGiftDigestPayload(payload)).toEqual(payload);
	});

	it('retains the accurate wishlist total when payload details are capped at ten', () => {
		let payload = addToNewGiftDigestPayload(null, {
			wishlistId: 'wishlist-0',
			shortId: 'list-0',
			title: 'List 0',
			giftNames: ['Gift 0'],
		});
		for (let index = 1; index < 11; index++) {
			payload = addToNewGiftDigestPayload(payload, {
				wishlistId: `wishlist-${index}`,
				shortId: `list-${index}`,
				title: `List ${index}`,
				giftNames: [`Gift ${index}`],
			});
		}
		payload = addToNewGiftDigestPayload(payload, {
			wishlistId: 'wishlist-10',
			shortId: 'list-10',
			title: 'List 10',
			giftNames: ['Another gift 10'],
		});

		expect(payload.wishlists).toHaveLength(10);
		expect(payload.overflowWishlistIds).toEqual(['wishlist-10']);
		expect(payload.wishlistCount).toBe(11);
		expect(payload.totalCount).toBe(12);
		expect(parseNewGiftDigestPayload(payload)).toEqual(payload);
		expect(getNewGiftDigestDisplay(payload, 'en')).toMatchObject({
			href: '/followed',
			message: '12 new gifts on 11 wishlists',
		});
	});

	it('caps overflow identities at a stable lower bound after the first untracked wishlist', () => {
		let payload = addToNewGiftDigestPayload(null, {
			wishlistId: 'wishlist-0',
			shortId: 'list-0',
			title: 'List 0',
			giftNames: ['Gift 0'],
		});
		for (let index = 1; index <= 110; index += 1) {
			payload = addToNewGiftDigestPayload(payload, {
				wishlistId: `wishlist-${index}`,
				shortId: `list-${index}`,
				title: `List ${index}`,
				giftNames: [`Gift ${index}`],
			});
		}
		expect(payload.overflowWishlistIds).toHaveLength(100);
		expect(payload.wishlistCount).toBe(111);
		expect(payload.wishlistCountCapped).toBe(true);

		for (const wishlistId of ['untracked-new', 'untracked-new', 'untracked-other']) {
			payload = addToNewGiftDigestPayload(payload, {
				wishlistId,
				shortId: wishlistId,
				title: wishlistId,
				giftNames: ['Another gift'],
			});
		}
		expect(payload.wishlistCount).toBe(111);
		expect(parseNewGiftDigestPayload(payload)).toEqual(payload);
		expect(getNewGiftDigestDisplay(payload, 'en').message).toContain('at least 111 wishlists');
		expect(getNewGiftDigestDisplay(payload, 'cs').message).toContain('nejméně 111 seznamech');
	});

	it('renders Czech and English summaries and chooses the correct destination', () => {
		const single = addToNewGiftDigestPayload(null, {
			wishlistId: 'a',
			shortId: 'vanoce',
			title: 'Vánoce',
			giftNames: ['Kolo'],
		});
		expect(getNewGiftDigestDisplay(single, 'cs')).toMatchObject({ href: '/w/vanoce' });
		expect(getNewGiftDigestDisplay(single, 'cs').message).toContain('1 nové přání');
		const multi = addToNewGiftDigestPayload(single, {
			wishlistId: 'b',
			shortId: 'birthday',
			title: 'Birthday',
			giftNames: ['Book'],
		});
		expect(getNewGiftDigestDisplay(multi, 'en')).toMatchObject({ href: '/followed' });
		expect(getNewGiftDigestDisplay(multi, 'en').message).toContain(
			'2 new gifts on 2 wishlists',
		);
	});
});
