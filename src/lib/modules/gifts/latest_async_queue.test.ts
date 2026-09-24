import { describe, expect, it, vi } from 'vitest';
import { createLatestAsyncQueue } from './latest_async_queue.js';

function deferred() {
	let resolve!: () => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

describe('createLatestAsyncQueue', () => {
	it('never overlaps persistence and persists the latest queued order last', async () => {
		const first = deferred();
		const second = deferred();
		const calls: string[][] = [];
		let active = 0;
		let maximumActive = 0;
		const worker = vi.fn(async (order: string[]) => {
			calls.push(order);
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await (calls.length === 1 ? first.promise : second.promise);
			active -= 1;
		});
		const queue = createLatestAsyncQueue(worker, async () => {});

		queue.enqueue(['a', 'b', 'c']);
		queue.enqueue(['b', 'a', 'c']);
		queue.enqueue(['c', 'b', 'a']);
		expect(calls).toEqual([['a', 'b', 'c']]);

		first.resolve();
		await vi.waitFor(() => expect(calls).toHaveLength(2));
		expect(calls[1]).toEqual(['c', 'b', 'a']);
		expect(maximumActive).toBe(1);

		second.resolve();
		await vi.waitFor(() => expect(active).toBe(0));
	});

	it('settles only after all queued persistence and reports the active drain result', async () => {
		const first = deferred();
		const second = deferred();
		const worker = vi
			.fn<(value: string) => Promise<void>>()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const queue = createLatestAsyncQueue(worker, async () => {});

		queue.enqueue('first');
		queue.enqueue('latest');
		const settlement = queue.whenIdle();
		let settled = false;
		void settlement.then(() => {
			settled = true;
		});

		first.resolve();
		await vi.waitFor(() => expect(worker).toHaveBeenCalledTimes(2));
		expect(settled).toBe(false);

		second.resolve();
		await expect(settlement).resolves.toBe(true);
		expect(await queue.whenIdle()).toBe(true);
	});

	it('reports a failed active drain after recovery and later queued work finish', async () => {
		const failedWork = deferred();
		const laterWork = deferred();
		const recovery = deferred();
		const worker = vi
			.fn<(value: string) => Promise<void>>()
			.mockImplementationOnce(() => failedWork.promise)
			.mockImplementationOnce(() => laterWork.promise);
		const onError = vi.fn(async () => recovery.promise);
		const queue = createLatestAsyncQueue(worker, onError);

		queue.enqueue('failed order');
		const settlement = queue.whenIdle();
		failedWork.reject(new Error('save failed'));
		await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
		queue.enqueue('order queued during recovery');
		let settled = false;
		void settlement.then(() => {
			settled = true;
		});
		expect(settled).toBe(false);

		recovery.resolve();
		await vi.waitFor(() => expect(worker).toHaveBeenCalledTimes(2));
		expect(settled).toBe(false);
		laterWork.resolve();
		await expect(settlement).resolves.toBe(false);
		await expect(queue.whenIdle()).resolves.toBe(false);
	});

	it('keeps an idle failure observable until a later drain succeeds', async () => {
		const worker = vi
			.fn<(value: string) => Promise<void>>()
			.mockRejectedValueOnce(new Error('ambiguous save'))
			.mockResolvedValueOnce();
		const queue = createLatestAsyncQueue(worker, async () => {});

		queue.enqueue('uncertain order');
		await vi.waitFor(() => expect(worker).toHaveBeenCalledOnce());
		await expect(queue.whenIdle()).resolves.toBe(false);
		await expect(queue.whenIdle()).resolves.toBe(false);

		queue.enqueue('verified later order');
		await expect(queue.whenIdle()).resolves.toBe(true);
	});
});
