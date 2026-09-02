import { describe, expect, it, vi } from 'vitest';
import {
	createLazySentryReplaySynchronizer,
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

	it('loads Replay only on an allowed URL and resumes it after a sensitive navigation', async () => {
		const replay = {
			startBuffering: vi.fn(),
			stop: vi.fn().mockResolvedValue(undefined),
		};
		const integration = { name: 'Replay' };
		const client = { addIntegration: vi.fn() };
		const loadIntegration = vi.fn().mockResolvedValue(integration);
		const synchronize = createLazySentryReplaySynchronizer({
			client,
			loadIntegration,
			getReplay: () => replay,
		});

		await synchronize(new URL('https://prejemesi.cz/reset-password?token=secret'));
		expect(loadIntegration).not.toHaveBeenCalled();

		await synchronize(new URL('https://prejemesi.cz/home'));
		expect(client.addIntegration).toHaveBeenCalledWith(integration);
		expect(replay.startBuffering).not.toHaveBeenCalled();

		await synchronize(new URL('https://prejemesi.cz/settings?private=true'));
		expect(replay.stop).toHaveBeenCalledWith({ flush: false });

		await synchronize(new URL('https://prejemesi.cz/home'));
		expect(replay.startBuffering).toHaveBeenCalledOnce();
	});

	it('adds Replay once when safe navigations overlap during chunk loading', async () => {
		let resolveIntegration: (integration: { name: string }) => void = () => {};
		const integrationPromise = new Promise<{ name: string }>((resolve) => {
			resolveIntegration = resolve;
		});
		const client = { addIntegration: vi.fn() };
		const synchronize = createLazySentryReplaySynchronizer({
			client,
			loadIntegration: () => integrationPromise,
			getReplay: () => undefined,
		});

		const first = synchronize(new URL('https://prejemesi.cz/home'));
		const second = synchronize(new URL('https://prejemesi.cz/settings'));
		resolveIntegration({ name: 'Replay' });
		await Promise.all([first, second]);

		expect(client.addIntegration).toHaveBeenCalledOnce();
	});

	it('disables Replay after a chunk load failure without rejecting navigation', async () => {
		const failure = new Error('chunk unavailable');
		const loadIntegration = vi.fn().mockRejectedValue(failure);
		const onFailure = vi.fn();
		const synchronize = createLazySentryReplaySynchronizer({
			client: { addIntegration: vi.fn() },
			loadIntegration,
			getReplay: () => undefined,
			onFailure,
		});

		await expect(synchronize(new URL('https://prejemesi.cz/home'))).resolves.toBeUndefined();
		await expect(
			synchronize(new URL('https://prejemesi.cz/settings')),
		).resolves.toBeUndefined();

		expect(loadIntegration).toHaveBeenCalledOnce();
		expect(onFailure).toHaveBeenCalledWith(failure);
	});

	it('does not add Replay when navigation becomes sensitive while its chunk loads', async () => {
		let resolveIntegration: (integration: { name: string }) => void = () => {};
		const integrationPromise = new Promise<{ name: string }>((resolve) => {
			resolveIntegration = resolve;
		});
		const client = { addIntegration: vi.fn() };
		const synchronize = createLazySentryReplaySynchronizer({
			client,
			loadIntegration: () => integrationPromise,
			getReplay: () => undefined,
		});

		const allowedNavigation = synchronize(new URL('https://prejemesi.cz/home'));
		await synchronize(new URL('https://prejemesi.cz/login'));
		resolveIntegration({ name: 'Replay' });
		await allowedNavigation;

		expect(client.addIntegration).not.toHaveBeenCalled();
	});
});
