import { describe, expect, it } from 'vitest';
import {
	giftContextActions,
	hasAdditionalGiftContextActions,
	offersReservationRelease,
} from './gift_context_actions.js';
import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';

describe('gift contextual actions', () => {
	it('offers visitors link actions only and no menu at all without a primary link', () => {
		expect(
			giftContextActions({
				role: 'visitor',
				primaryUrl: 'https://shop.test/gift',
				readOnly: false,
			}),
		).toEqual(['open', 'copy']);
		expect(giftContextActions({ role: 'visitor', primaryUrl: null, readOnly: false })).toEqual(
			[],
		);
	});

	it('offers managers permitted mutations but excludes card-only actions', () => {
		expect(
			giftContextActions({
				role: 'moderator',
				primaryUrl: 'https://shop.test/gift',
				readOnly: false,
				canEdit: true,
			}),
		).toEqual(['open', 'copy', 'edit', 'priority', 'category', 'received', 'multiselect']);
	});

	it('offers reservation ownership and purchased actions from explicit capabilities', () => {
		expect(
			giftContextActions({
				role: 'moderator',
				primaryUrl: null,
				readOnly: false,
				canEdit: false,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
			}),
		).toEqual([
			'priority',
			'category',
			'received',
			'multiselect',
			'cancel-reservation',
			'purchased',
		]);
	});

	it('derives More visibility from the commands currently placed as direct actions', () => {
		expect(hasAdditionalGiftContextActions(['reserve'], ['reserve'])).toBe(false);
		expect(
			hasAdditionalGiftContextActions(['received', 'reserve'], ['received', 'reserve']),
		).toBe(false);
		expect(hasAdditionalGiftContextActions(['received', 'reserve'], ['reserve'])).toBe(true);
		expect(hasAdditionalGiftContextActions(['open', 'reserve'], ['reserve'])).toBe(true);
	});

	it('offers release to administrators only when the gift holds a reservation they may release', () => {
		const visitor = { role: 'visitor', primaryUrl: null, readOnly: false } as const;

		expect(
			giftContextActions({
				...visitor,
				releaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
				releaseLedgerCount: 1,
			}),
		).toEqual(['release-reservation']);
		expect(
			giftContextActions({
				...visitor,
				releaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
				releaseLedgerCount: 0,
			}),
		).toEqual([]);
		for (const releaseCapability of [
			RESERVATION_RELEASE_CAPABILITY.guestOnly,
			RESERVATION_RELEASE_CAPABILITY.none,
		]) {
			expect(
				giftContextActions({ ...visitor, releaseCapability, releaseLedgerCount: 1 }),
			).toEqual([]);
		}
	});

	it('keeps only cancellation of an own reservation in archived contexts', () => {
		expect(
			giftContextActions({
				role: 'visitor',
				primaryUrl: 'https://shop.test/gift',
				readOnly: true,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
			}),
		).toEqual(['open', 'copy', 'cancel-reservation']);
	});

	it('omits link actions from the Gift viewer More because the caption lists every link', () => {
		expect(
			giftContextActions({
				role: 'visitor',
				primaryUrl: 'https://shop.test/gift',
				readOnly: false,
				canReserve: true,
				ownsReservation: true,
				canTrackPurchased: true,
				origin: 'viewer',
			}),
		).toEqual(['cancel-reservation', 'purchased']);
	});

	it('lets the Gift viewer More show every release its lane offers, while the card menu stays administrator-only', () => {
		for (const releaseCapability of Object.values(RESERVATION_RELEASE_CAPABILITY)) {
			const laneOffersRelease = offersReservationRelease({
				releaseCapability,
				releaseLedgerCount: 1,
				origin: 'viewer',
			});
			const viewerMoreActions = giftContextActions({
				role: 'visitor',
				primaryUrl: null,
				readOnly: false,
				releaseCapability,
				releaseLedgerCount: 1,
				origin: 'viewer',
			});
			expect(viewerMoreActions.includes('release-reservation')).toBe(laneOffersRelease);
		}
		expect(
			offersReservationRelease({
				releaseCapability: RESERVATION_RELEASE_CAPABILITY.guestOnly,
				releaseLedgerCount: 1,
				origin: 'viewer',
			}),
		).toBe(true);
		expect(
			offersReservationRelease({
				releaseCapability: RESERVATION_RELEASE_CAPABILITY.guestOnly,
				releaseLedgerCount: 1,
				origin: 'card',
			}),
		).toBe(false);
		expect(
			offersReservationRelease({
				releaseCapability: RESERVATION_RELEASE_CAPABILITY.any,
				releaseLedgerCount: 0,
				origin: 'viewer',
			}),
		).toBe(false);
	});
});
