import { describe, expect, it } from 'vitest';
import { chatDayStart } from './limits.js';

describe('chatDayStart', () => {
	it('starts the day at midnight Prague time in winter', () => {
		expect(chatDayStart(new Date('2026-01-15T23:30:00Z')).toISOString()).toBe(
			'2026-01-15T23:00:00.000Z',
		);
		expect(chatDayStart(new Date('2026-01-15T10:00:00Z')).toISOString()).toBe(
			'2026-01-14T23:00:00.000Z',
		);
	});

	it('starts the day at midnight Prague time in summer', () => {
		expect(chatDayStart(new Date('2026-07-01T21:59:00Z')).toISOString()).toBe(
			'2026-06-30T22:00:00.000Z',
		);
		expect(chatDayStart(new Date('2026-07-01T22:00:00Z')).toISOString()).toBe(
			'2026-07-01T22:00:00.000Z',
		);
	});

	it('keeps the midnight offset on the days the clocks change', () => {
		// Clocks go forward at 2:00 on 29 March 2026 and back at 3:00 on 25 October 2026.
		expect(chatDayStart(new Date('2026-03-29T20:00:00Z')).toISOString()).toBe(
			'2026-03-28T23:00:00.000Z',
		);
		expect(chatDayStart(new Date('2026-10-25T20:00:00Z')).toISOString()).toBe(
			'2026-10-24T22:00:00.000Z',
		);
	});
});
