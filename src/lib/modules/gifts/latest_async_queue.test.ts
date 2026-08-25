import { describe, expect, it, vi } from 'vitest';
import { createLatestAsyncQueue } from './latest_async_queue.js';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
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
});
