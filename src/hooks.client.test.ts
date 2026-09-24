import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
	init: vi.fn(),
	captureException: vi.fn(),
	addIntegration: vi.fn(),
	handleError: vi.fn(),
	replayIntegration: vi.fn(() => ({ name: 'Replay' })),
	stopReplay: vi.fn().mockResolvedValue(undefined),
	startBuffering: vi.fn(),
	replayModuleImportStarted: vi.fn(),
	replayModuleLoad: Promise.resolve(),
}));

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SENTRY_DSN: 'https://public@example.invalid/1' },
}));
vi.mock('$lib/observability/sentry_core_client.js', () => ({
	init: sentry.init,
	captureException: sentry.captureException,
	getClient: () => ({ addIntegration: sentry.addIntegration }),
	handleErrorWithSentry: () => sentry.handleError,
}));
vi.mock('$lib/observability/sentry_client.js', () => ({
	createSentryClientOptions: (options: unknown) => options,
}));
vi.mock('$lib/observability/sentry_privacy.js', () => ({
	sanitizeSentryReplayEvent: (event: unknown) => event,
}));
vi.mock('@sentry/replay', async () => {
	sentry.replayModuleImportStarted();
	await sentry.replayModuleLoad;
	return {
		replayIntegration: sentry.replayIntegration,
		getReplay: () => ({ stop: sentry.stopReplay, startBuffering: sentry.startBuffering }),
	};
});

describe('client observability hook', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		sentry.replayModuleLoad = Promise.resolve();
	});

	it('loads core Sentry only after load, paint, delay, and idle, then flushes early errors', async () => {
		const listeners = new Map<string, (event: unknown) => void>();
		const animationFrames: Array<() => void> = [];
		const timers: Array<() => void> = [];
		const idleCallbacks: Array<() => void> = [];
		const windowStub = {
			document: { readyState: 'loading' },
			location: { href: 'https://prejemesi.cz/login' },
			addEventListener: (type: string, listener: (event: unknown) => void) => {
				listeners.set(type, listener);
			},
			removeEventListener: (type: string) => listeners.delete(type),
			requestAnimationFrame: (callback: () => void) => {
				animationFrames.push(callback);
				return animationFrames.length;
			},
			setTimeout: (callback: () => void) => {
				timers.push(callback);
				return timers.length;
			},
			requestIdleCallback: (callback: () => void) => {
				idleCallbacks.push(callback);
				return idleCallbacks.length;
			},
		};
		vi.stubGlobal('window', windowStub);

		const earlyError = new Error('before Sentry');
		const hooks = await import('./hooks.client.js');
		listeners.get('error')?.({ error: earlyError });
		hooks.init();

		expect(sentry.init).not.toHaveBeenCalled();
		listeners.get('load')?.({});
		animationFrames.shift()?.();
		animationFrames.shift()?.();
		timers.shift()?.();
		expect(sentry.init).not.toHaveBeenCalled();
		idleCallbacks.shift()?.();

		await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledOnce());
		expect(sentry.captureException).toHaveBeenCalledWith(earlyError);
		expect(sentry.replayIntegration).not.toHaveBeenCalled();
	});

	it('does not add Replay when navigation becomes sensitive while its module loads', async () => {
		const idle: Array<() => void> = [];
		const listeners = new Map<string, (event: unknown) => void>();
		const location = { href: 'https://prejemesi.cz/home' };
		let resolveReplayModule = () => {};
		sentry.replayModuleLoad = new Promise<void>((resolve) => {
			resolveReplayModule = resolve;
		});
		vi.stubGlobal('window', {
			document: { readyState: 'complete' },
			location,
			addEventListener: (type: string, listener: (event: unknown) => void) =>
				listeners.set(type, listener),
			removeEventListener: vi.fn(),
			requestAnimationFrame: (callback: () => void) => (callback(), 1),
			setTimeout: (callback: () => void) => (callback(), 1),
			requestIdleCallback: (callback: () => void) => (idle.push(callback), idle.length),
		});
		const hooks = await import('./hooks.client.js');
		hooks.init();
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(idle).toHaveLength(1));
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.replayModuleImportStarted).toHaveBeenCalledOnce());

		location.href = 'https://prejemesi.cz/login';
		listeners.get('sentry-replay-navigation')?.(new CustomEvent('x', { detail: '/login' }));
		resolveReplayModule();

		await vi.waitFor(() => expect(sentry.replayIntegration).toHaveBeenCalledOnce());
		expect(sentry.addIntegration).not.toHaveBeenCalled();
	});

	it('loads Replay for a safe initial route after scheduled idle work', async () => {
		const idle: Array<() => void> = [];
		vi.stubGlobal('window', {
			document: { readyState: 'complete' },
			location: { href: 'https://prejemesi.cz/home' },
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			requestAnimationFrame: (callback: () => void) => (callback(), 1),
			setTimeout: (callback: () => void) => (callback(), 1),
			requestIdleCallback: (callback: () => void) => (idle.push(callback), idle.length),
		});
		const hooks = await import('./hooks.client.js');
		hooks.init();
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledOnce());
		expect(sentry.replayIntegration).not.toHaveBeenCalled();
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.replayIntegration).toHaveBeenCalledOnce());
	});

	it('stops Replay on safe-to-sensitive navigation and resumes on sensitive-to-safe navigation', async () => {
		const idle: Array<() => void> = [];
		const listeners = new Map<string, (event: unknown) => void>();
		const location = { href: 'https://prejemesi.cz/home' };
		vi.stubGlobal('window', {
			document: { readyState: 'complete' },
			location,
			addEventListener: (type: string, listener: (event: unknown) => void) =>
				listeners.set(type, listener),
			removeEventListener: vi.fn(),
			requestAnimationFrame: (callback: () => void) => (callback(), 1),
			setTimeout: (callback: () => void) => (callback(), 1),
			requestIdleCallback: (callback: () => void) => (idle.push(callback), idle.length),
		});
		const hooks = await import('./hooks.client.js');
		hooks.init();
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.init).toHaveBeenCalledOnce());
		idle.shift()?.();
		await vi.waitFor(() => expect(sentry.replayIntegration).toHaveBeenCalledOnce());
		location.href = 'https://prejemesi.cz/login';
		listeners.get('sentry-replay-navigation')?.(new CustomEvent('x', { detail: '/login' }));
		await vi.waitFor(() => expect(sentry.stopReplay).toHaveBeenCalledWith({ flush: false }));
		location.href = 'https://prejemesi.cz/home';
		listeners.get('sentry-replay-navigation')?.(new CustomEvent('x', { detail: '/home' }));
		await vi.waitFor(() => expect(sentry.startBuffering).toHaveBeenCalledOnce());
	});

	it('initializes core immediately when handleError runs before idle', async () => {
		vi.stubGlobal('window', {
			document: { readyState: 'loading' },
			location: { href: 'https://prejemesi.cz/login' },
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			requestAnimationFrame: vi.fn(),
			setTimeout: vi.fn(),
			requestIdleCallback: vi.fn(),
		});
		const hooks = await import('./hooks.client.js');
		await hooks.handleError({ error: new Error('early') } as never);
		expect(sentry.init).toHaveBeenCalledOnce();
		expect(sentry.handleError).toHaveBeenCalled();
	});
});
