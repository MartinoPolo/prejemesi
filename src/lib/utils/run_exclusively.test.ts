import { describe, expect, it, vi } from 'vitest';
import { runExclusively } from './run_exclusively.js';

function deferred() {
	let resolve = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe('runExclusively', () => {
	it('ignores a repeated request while the same key is pending', async () => {
		const pendingKeys = new Set<string>();
		const command = deferred();
		const task = vi.fn(() => command.promise);

		const first = runExclusively(pendingKeys, 'gift-1', task);
		const repeated = runExclusively(pendingKeys, 'gift-1', task);
		expect(pendingKeys.has('gift-1')).toBe(true);
		await repeated;
		expect(task).toHaveBeenCalledOnce();

		command.resolve();
		await first;
		expect(pendingKeys.has('gift-1')).toBe(false);
	});

	it('runs tasks for different keys independently', async () => {
		const pendingKeys = new Set<string>();
		const command = deferred();
		const otherTask = vi.fn(async () => {});

		const first = runExclusively(pendingKeys, 'gift-1', () => command.promise);
		await runExclusively(pendingKeys, 'gift-2', otherTask);
		expect(otherTask).toHaveBeenCalledOnce();

		command.resolve();
		await first;
	});

	it('releases the key when the task fails, so the action can be retried', async () => {
		const pendingKeys = new Set<string>();
		const command = deferred();

		const failing = runExclusively(pendingKeys, 'gift-1', () => command.promise);
		command.reject(new Error('offline'));
		await expect(failing).rejects.toThrow('offline');
		expect(pendingKeys.has('gift-1')).toBe(false);

		const retry = vi.fn(async () => {});
		await runExclusively(pendingKeys, 'gift-1', retry);
		expect(retry).toHaveBeenCalledOnce();
	});
});
