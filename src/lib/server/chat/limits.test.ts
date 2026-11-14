import { describe, expect, it } from 'vitest';
import { CHAT_RUNNER_LIMITS, chatDayStart } from './limits.js';

// Imported by URL, so the type check leaves the plain-JavaScript runner script alone.
const chatRunnerScriptUrl = new URL('../../../../scripts/chat_runner.mjs', import.meta.url).href;

describe('the chat runner script', () => {
	it('splits its reports by the limits the app accepts and retries them while the app waits', async () => {
		const runnerScript = (await import(/* @vite-ignore */ chatRunnerScriptUrl)) as {
			REPORT_LIMITS: unknown;
		};
		expect(runnerScript.REPORT_LIMITS).toEqual({
			eventsPerReport: CHAT_RUNNER_LIMITS.eventsPerReport,
			textEventMaxLength: CHAT_RUNNER_LIMITS.textEventMaxLength,
			queryMaxLength: CHAT_RUNNER_LIMITS.queryMaxLength,
			heartbeatTimeoutMs: CHAT_RUNNER_LIMITS.heartbeatTimeoutMs,
		});
	});
});

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
