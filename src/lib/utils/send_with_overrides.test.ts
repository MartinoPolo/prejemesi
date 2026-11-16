import { describe, expect, it, vi } from 'vitest';
import type { RemoteQueryOverride } from '@sveltejs/kit';
import { sendWithOverrides } from './send_with_overrides.js';

/** Mirrors a SvelteKit query: overrides layer over the raw value, which refreshes replace. */
function fakeQuery<Value>(initialValue: Value) {
	let raw = initialValue;
	const overrides: Array<(current: Value) => Value> = [];
	return {
		get current() {
			return overrides.reduce((value, override) => override(value), raw);
		},
		refresh(nextRaw: Value) {
			raw = nextRaw;
		},
		withOverride(update: (current: Value) => Value): RemoteQueryOverride {
			overrides.push(update);
			return vi.fn(() => {
				overrides.splice(overrides.indexOf(update), 1);
			});
		},
	};
}

/** Mirrors a SvelteKit command: it releases the passed overrides once the request settles. */
function fakeCommand<Result>(request: Promise<Result>) {
	let releases: RemoteQueryOverride[] = [];
	const promise = (async () => {
		await Promise.resolve();
		try {
			return await request;
		} finally {
			releases.forEach((release) => release());
		}
	})();
	return Object.assign(promise, {
		updates(...overrides: RemoteQueryOverride[]) {
			releases = overrides;
			return promise;
		},
	});
}

function deferred<Value>() {
	let resolve: (value: Value) => void = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe('sendWithOverrides', () => {
	it('shows the optimistic value while pending and restores the exact prior value on failure', async () => {
		const query = fakeQuery({ priority: 'low' });
		const priorValue = query.current;
		const request = deferred<never>();
		const release = query.withOverride((current) => ({ ...current, priority: 'high' }));

		const sent = sendWithOverrides([release], () => fakeCommand(request.promise));
		expect(query.current).toEqual({ priority: 'high' });

		request.reject(new Error('server failed'));
		await expect(sent).rejects.toThrow('server failed');
		expect(query.current).toBe(priorValue);
		expect(release).toHaveBeenCalledOnce();
	});

	it('keeps the optimistic value over a refresh that lands while the request is pending', async () => {
		const query = fakeQuery({ priority: 'low', name: 'Kolo' });
		const request = deferred<string>();
		const release = query.withOverride((current) => ({ ...current, priority: 'high' }));

		const sent = sendWithOverrides([release], () => fakeCommand(request.promise));
		query.refresh({ priority: 'low', name: 'Koloběžka' });
		expect(query.current).toEqual({ priority: 'high', name: 'Koloběžka' });

		query.refresh({ priority: 'high', name: 'Koloběžka' });
		request.resolve('saved');
		await expect(sent).resolves.toBe('saved');
		expect(query.current).toEqual({ priority: 'high', name: 'Koloběžka' });
		expect(release).toHaveBeenCalledOnce();
	});

	it('releases the overrides itself when the command never starts', async () => {
		const query = fakeQuery({ priority: 'low' });
		const release = query.withOverride((current) => ({ ...current, priority: 'high' }));

		const sent = sendWithOverrides([release], () => {
			throw new Error('not sent');
		});

		await expect(sent).rejects.toThrow('not sent');
		expect(query.current).toEqual({ priority: 'low' });
		expect(release).toHaveBeenCalledOnce();
	});
});
