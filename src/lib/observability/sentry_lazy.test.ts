import { describe, expect, it, vi } from 'vitest';
import {
	createSingletonSafeLoader,
	installEarlyErrorBuffer,
	scheduleAfterLoadAndIdle,
} from './sentry_lazy.js';

describe('scheduleAfterLoadAndIdle', () => {
	it('waits for load, a rendered frame, the startup delay, and browser idle', () => {
		let onLoad: (() => void) | undefined;
		const animationFrames: Array<() => void> = [];
		let afterDelay: (() => void) | undefined;
		let onIdle: (() => void) | undefined;
		const run = vi.fn();
		const target = {
			document: { readyState: 'loading' },
			addEventListener: vi.fn((_type: string, listener: () => void) => {
				onLoad = listener;
			}),
			requestAnimationFrame: vi.fn((callback: () => void) => {
				animationFrames.push(callback);
				return animationFrames.length;
			}),
			setTimeout: vi.fn((callback: () => void) => {
				afterDelay = callback;
				return 1;
			}),
			requestIdleCallback: vi.fn((callback: () => void) => {
				onIdle = callback;
				return 1;
			}),
		};

		scheduleAfterLoadAndIdle(target, run);
		expect(run).not.toHaveBeenCalled();

		onLoad?.();
		expect(run).not.toHaveBeenCalled();

		animationFrames.shift()?.();
		animationFrames.shift()?.();
		expect(run).not.toHaveBeenCalled();

		afterDelay?.();
		expect(run).not.toHaveBeenCalled();

		expect(target.requestIdleCallback).toHaveBeenCalledWith(run, { timeout: 2_000 });
		onIdle?.();
		expect(run).toHaveBeenCalledOnce();
	});
});

describe('installEarlyErrorBuffer', () => {
	it('buffers errors and rejections up to its bound, then flushes and detaches', () => {
		const listeners = new Map<string, (event: unknown) => void>();
		const target = {
			addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
				listeners.set(type, listener);
			}),
			removeEventListener: vi.fn((type: string) => listeners.delete(type)),
		};
		const buffer = installEarlyErrorBuffer(target, 2);
		const first = new Error('first');
		const second = new Error('second');

		listeners.get('error')?.({ error: first });
		listeners.get('unhandledrejection')?.({ reason: second });
		listeners.get('error')?.({ error: new Error('overflow') });

		const capture = vi.fn();
		buffer.flush(capture);

		expect(capture.mock.calls).toEqual([[first], [second]]);
		expect(target.removeEventListener).toHaveBeenCalledTimes(2);
	});

	it('discards buffered values and detaches when SDK loading fails', () => {
		const listeners = new Map<string, (event: unknown) => void>();
		const target = {
			addEventListener: (type: string, listener: (event: unknown) => void) => {
				listeners.set(type, listener);
			},
			removeEventListener: (type: string) => listeners.delete(type),
		};
		const buffer = installEarlyErrorBuffer(target);
		listeners.get('error')?.({ error: new Error('discarded') });

		buffer.discard();
		const capture = vi.fn();
		buffer.flush(capture);

		expect(capture).not.toHaveBeenCalled();
		expect(listeners.size).toBe(0);
	});
});

describe('createSingletonSafeLoader', () => {
	it('loads once and converts SDK load failures into a non-blocking result', async () => {
		const failure = new Error('chunk failed');
		const load = vi.fn().mockRejectedValue(failure);
		const onFailure = vi.fn();
		const loader = createSingletonSafeLoader(load, onFailure);

		const first = loader();
		const second = loader();

		expect(first).toBe(second);
		await expect(first).resolves.toBeUndefined();
		expect(load).toHaveBeenCalledOnce();
		expect(onFailure).toHaveBeenCalledWith(failure);
	});
});
