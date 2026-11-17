import { describe, expect, it, vi } from 'vitest';
import { createIdlePreloadQueue } from './idle_preload_queue.js';

function controllableLoader() {
	let finishLoad!: () => void;
	const loader = {
		component: undefined as unknown,
		load: vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishLoad = resolve;
				}),
		),
	};
	return { loader, finishLoad: () => finishLoad() };
}

function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createIdlePreloadQueue', () => {
	it('preloads one chunk per idle period, starting the next only after the previous settles', async () => {
		const idleCallbacks: Array<() => void> = [];
		const queue = createIdlePreloadQueue((run) => idleCallbacks.push(run));
		const first = controllableLoader();
		const second = controllableLoader();

		queue.add(first.loader);
		queue.add(second.loader);
		expect(idleCallbacks).toHaveLength(1);
		expect(first.loader.load).not.toHaveBeenCalled();

		idleCallbacks[0]();
		expect(first.loader.load).toHaveBeenCalledOnce();
		expect(second.loader.load).not.toHaveBeenCalled();
		await flushPromises();
		expect(idleCallbacks).toHaveLength(1);

		first.finishLoad();
		await flushPromises();
		expect(idleCallbacks).toHaveLength(2);
		expect(second.loader.load).not.toHaveBeenCalled();

		idleCallbacks[1]();
		expect(second.loader.load).toHaveBeenCalledOnce();
	});

	it('continues with the next chunk after a failed preload', async () => {
		const idleCallbacks: Array<() => void> = [];
		const queue = createIdlePreloadQueue((run) => idleCallbacks.push(run));
		const failing = {
			component: undefined,
			load: vi.fn().mockRejectedValue(new Error('offline')),
		};
		const next = controllableLoader();

		queue.add(failing);
		queue.add(next.loader);
		idleCallbacks[0]();
		await flushPromises();

		idleCallbacks[1]();
		expect(next.loader.load).toHaveBeenCalledOnce();
	});

	it('skips loaders removed before their idle period and loaders already loaded', async () => {
		const idleCallbacks: Array<() => void> = [];
		const queue = createIdlePreloadQueue((run) => idleCallbacks.push(run));
		const removed = controllableLoader();
		const loaded = { component: {}, load: vi.fn() };

		const remove = queue.add(removed.loader);
		queue.add(loaded);
		remove();
		idleCallbacks[0]?.();
		await flushPromises();

		expect(removed.loader.load).not.toHaveBeenCalled();
		expect(loaded.load).not.toHaveBeenCalled();
	});
});
