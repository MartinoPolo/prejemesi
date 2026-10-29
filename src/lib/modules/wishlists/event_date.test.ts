import { describe, expect, it } from 'vitest';
import { hasUpcomingEventDate } from './event_date.js';

// Owner rule 2026-10-17 (#479): an occasion wishlist may become permanent only without an upcoming
// event date; the event passes at the same instant the archive prompt appears.
describe('hasUpcomingEventDate', () => {
	const now = new Date('2026-12-24T12:00:00Z');

	it.each([
		['no event date', null, false],
		['one millisecond ago', new Date(now.getTime() - 1), false],
		['exactly now', new Date(now.getTime()), true],
		['one millisecond ahead', new Date(now.getTime() + 1), true],
	])('%s → %s', (_label, eventDate, expected) => {
		expect(hasUpcomingEventDate(eventDate, now)).toBe(expected);
	});
});
