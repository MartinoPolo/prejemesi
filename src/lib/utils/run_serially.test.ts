import { describe, expect, it } from 'vitest';
import { runSerially } from './run_serially.js';

function deferred<Value = void>() {
	let resolve: (value: Value) => void = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

async function flushMicrotasks() {
	for (let round = 0; round < 5; round += 1) {
		await Promise.resolve();
	}
}

describe('runSerially', () => {
	it('starts a task for the same key only after the previous one settles', async () => {
		const queueTails = new Map<string, Promise<void>>();
		const firstRequest = deferred<string>();
		const started: string[] = [];

		const first = runSerially(queueTails, 'gift-1', () => {
			started.push('first');
			return firstRequest.promise;
		});
		const second = runSerially(queueTails, 'gift-1', async () => {
			started.push('second');
			return 'second result';
		});
		await flushMicrotasks();
		expect(started).toEqual(['first']);

		firstRequest.resolve('first result');
		await expect(first).resolves.toBe('first result');
		await expect(second).resolves.toBe('second result');
		expect(started).toEqual(['first', 'second']);
	});

	it('runs the next task after a failure and still reports that failure to its caller', async () => {
		const queueTails = new Map<string, Promise<void>>();
		const failure = new Error('server failed');

		const first = runSerially(queueTails, 'gift-1', () => Promise.reject(failure));
		const second = runSerially(queueTails, 'gift-1', async () => 'second result');

		await expect(first).rejects.toBe(failure);
		await expect(second).resolves.toBe('second result');
	});

	it('runs tasks for different keys independently', async () => {
		const queueTails = new Map<string, Promise<void>>();
		const blocked = deferred();
		const started: string[] = [];

		void runSerially(queueTails, 'gift-1', () => blocked.promise);
		await runSerially(queueTails, 'gift-2', async () => {
			started.push('gift-2');
		});

		expect(started).toEqual(['gift-2']);
		blocked.resolve();
	});

	it('forgets a key once its last task settles', async () => {
		const queueTails = new Map<string, Promise<void>>();
		const firstRequest = deferred();
		const secondRequest = deferred();

		const first = runSerially(queueTails, 'gift-1', () => firstRequest.promise);
		const second = runSerially(queueTails, 'gift-1', () => secondRequest.promise);
		expect(queueTails.has('gift-1')).toBe(true);

		firstRequest.resolve();
		await first;
		await flushMicrotasks();
		expect(queueTails.has('gift-1')).toBe(true);

		secondRequest.resolve();
		await second;
		await flushMicrotasks();
		expect(queueTails.has('gift-1')).toBe(false);
	});
});
