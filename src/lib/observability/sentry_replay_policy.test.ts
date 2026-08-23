import { describe, expect, it, vi } from 'vitest';
import {
	createSentryReplaySynchronizer,
	shouldDisableSentryReplay,
} from './sentry_replay_policy.js';

describe('shouldDisableSentryReplay', () => {
	it.each([
		'https://prejemesi.cz/register',
		'https://prejemesi.cz/en/magic-link',
		'https://prejemesi.cz/reset-password?token=secret',
		'https://prejemesi.cz/w/list-id/claim/claim-token',
		'https://prejemesi.cz/en/w/list-id/invite/invite-token',
		'https://prejemesi.cz/unsubscribe?token=secret',
		'https://prejemesi.cz/w/list-id?filter=private',
	])('disables replay for sensitive URL %s', (url) => {
		expect(shouldDisableSentryReplay(new URL(url))).toBe(true);
	});

	it.each([
		'https://prejemesi.cz/',
		'https://prejemesi.cz/home',
		'https://prejemesi.cz/w/list-id',
		'https://prejemesi.cz/settings',
	])('allows privacy-masked replay for safe URL %s', (url) => {
		expect(shouldDisableSentryReplay(new URL(url))).toBe(false);
	});

	it('discards a sensitive recording and resumes error buffering on a safe route', async () => {
		const replay = {
			startBuffering: vi.fn(),
			stop: vi.fn().mockResolvedValue(undefined),
		};
		const synchronize = createSentryReplaySynchronizer(replay);

		synchronize(new URL('https://prejemesi.cz/reset-password?token=secret'));
		synchronize(new URL('https://prejemesi.cz/home'));
		await Promise.resolve();

		expect(replay.stop).toHaveBeenCalledOnce();
		expect(replay.stop).toHaveBeenCalledWith({ flush: false });
		expect(replay.startBuffering).toHaveBeenCalledOnce();
	});
});
