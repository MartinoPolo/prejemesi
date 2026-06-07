import { describe, it, expect } from 'vitest';
import {
	GRACE_WINDOW_MS,
	isWithinGraceWindow,
	graceWindowExpiresAt,
	formatGraceCountdown,
} from './grace_window.js';

const SHARE = new Date('2024-02-01T12:00:00.000Z');

describe('isWithinGraceWindow', () => {
	it('is open immediately after the last edit', () => {
		expect(isWithinGraceWindow(SHARE, SHARE)).toBe(true);
	});

	it('is open one second before the window closes', () => {
		const now = new Date(SHARE.getTime() + GRACE_WINDOW_MS - 1000);
		expect(isWithinGraceWindow(SHARE, now)).toBe(true);
	});

	it('is closed exactly at the boundary (exclusive)', () => {
		const now = new Date(SHARE.getTime() + GRACE_WINDOW_MS);
		expect(isWithinGraceWindow(SHARE, now)).toBe(false);
	});

	it('is closed after the window elapses', () => {
		const now = new Date(SHARE.getTime() + GRACE_WINDOW_MS + 1);
		expect(isWithinGraceWindow(SHARE, now)).toBe(false);
	});

	it('accepts an ISO string for the last-edit timestamp', () => {
		const now = new Date(SHARE.getTime() + 30_000);
		expect(isWithinGraceWindow(SHARE.toISOString(), now)).toBe(true);
	});

	it('is closed when the last-edit timestamp is null (never editable)', () => {
		expect(isWithinGraceWindow(null, SHARE)).toBe(false);
	});

	it('is closed for an unparseable timestamp', () => {
		expect(isWithinGraceWindow('not-a-date', SHARE)).toBe(false);
	});
});

describe('graceWindowExpiresAt', () => {
	it('returns lastEdit + 2 minutes', () => {
		expect(graceWindowExpiresAt(SHARE)).toEqual(new Date(SHARE.getTime() + GRACE_WINDOW_MS));
	});

	it('returns null when there is no last-edit timestamp', () => {
		expect(graceWindowExpiresAt(null)).toBeNull();
	});
});

describe('formatGraceCountdown', () => {
	it('formats a full window as 2:00', () => {
		expect(formatGraceCountdown(GRACE_WINDOW_MS)).toBe('2:00');
	});

	it('zero-pads the seconds', () => {
		expect(formatGraceCountdown(65_000)).toBe('1:05');
	});

	it('rounds up partial seconds so the last second reads 0:01', () => {
		expect(formatGraceCountdown(500)).toBe('0:01');
	});

	it('clamps negative input to 0:00', () => {
		expect(formatGraceCountdown(-5000)).toBe('0:00');
	});
});
