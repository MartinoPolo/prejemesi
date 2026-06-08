import { describe, it, expect } from 'vitest';
import {
	followedListState,
	FOLLOWED_LIST_STATE,
	type FollowedWishlist,
} from './dashboard_types.js';
import { eventCountdown } from './event_countdown.js';

/** Minimal FollowedWishlist for state derivation — only the reservation counters are read. */
function followed(myReservations: number, myPurchased: number): FollowedWishlist {
	return { myReservations, myPurchased } as FollowedWishlist;
}

describe('followedListState', () => {
	it('is open when nothing is reserved', () => {
		expect(followedListState(followed(0, 0))).toBe(FOLLOWED_LIST_STATE.open);
	});

	it('is reserved when some gifts are claimed but not all marked bought', () => {
		expect(followedListState(followed(2, 0))).toBe(FOLLOWED_LIST_STATE.reserved);
		expect(followedListState(followed(2, 1))).toBe(FOLLOWED_LIST_STATE.reserved);
	});

	it('is bought only when every reservation is marked bought', () => {
		expect(followedListState(followed(2, 2))).toBe(FOLLOWED_LIST_STATE.bought);
		// Defensive: purchased can never exceed reservations, but >= must still resolve to bought.
		expect(followedListState(followed(1, 3))).toBe(FOLLOWED_LIST_STATE.bought);
	});
});

describe('eventCountdown', () => {
	const now = new Date('2026-06-08T12:00:00Z');

	it('returns null when there is no date or the event has passed', () => {
		expect(eventCountdown(null, now)).toBeNull();
		expect(eventCountdown(new Date('2026-06-07T12:00:00Z'), now)).toBeNull();
	});

	it('returns a label for today and tomorrow', () => {
		expect(eventCountdown(new Date('2026-06-08T23:00:00Z'), now)).toBeTruthy();
		expect(eventCountdown(new Date('2026-06-09T06:00:00Z'), now)).toBeTruthy();
	});

	it('includes the day count for multi-day countdowns', () => {
		expect(eventCountdown(new Date('2026-06-13T12:00:00Z'), now)).toContain('5');
		expect(eventCountdown(new Date('2026-06-10T12:00:00Z'), now)).toContain('2');
	});
});
