import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getRequestEvent = vi.hoisted(() => vi.fn<() => RequestEvent>());

vi.mock('$app/server', () => ({ getRequestEvent }));

const { withPreparedStatements } = await import('./index.js');
const { serverTimingHeader, startServerTiming } = await import('../server_timing.js');

/**
 * Mirrors the postgres.js query contract the timing relies on: it runs once, when first awaited
 * (`then`, `catch` or `finally`), and `values()` switches the result shape and returns itself.
 */
class FakeQuery extends Promise<unknown> {
	static get [Symbol.species]() {
		return Promise;
	}

	executions = 0;
	private shape: 'objects' | 'values' = 'objects';
	private settle: { resolve: (value: unknown) => void; reject: (reason: unknown) => void };

	constructor(private readonly failure?: Error) {
		let settle!: FakeQuery['settle'];
		super((resolve, reject) => {
			settle = { resolve, reject };
		});
		this.settle = settle;
	}

	values() {
		this.shape = 'values';
		return this;
	}

	private handle() {
		if (this.executions > 0) {
			return;
		}
		this.executions += 1;
		queueMicrotask(() => {
			if (this.failure !== undefined) {
				this.settle.reject(this.failure);
				return;
			}
			this.settle.resolve(this.shape === 'values' ? [['Martin']] : [{ name: 'Martin' }]);
		});
	}

	override then<TResult1 = unknown, TResult2 = never>(
		onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
		onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): Promise<TResult1 | TResult2> {
		this.handle();
		return super.then(onFulfilled, onRejected);
	}

	override catch<TResult = never>(
		onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
	): Promise<unknown> {
		this.handle();
		return super.catch(onRejected);
	}

	override finally(onFinally?: (() => void) | null): Promise<unknown> {
		this.handle();
		return super.finally(onFinally);
	}
}

function createTimedRequest(): RequestEvent {
	const event = { locals: {} } as RequestEvent;
	startServerTiming(event);
	getRequestEvent.mockReturnValue(event);
	return event;
}

function databaseClientReturning(query: FakeQuery) {
	const unsafe = vi.fn(() => query);
	return {
		database: withPreparedStatements({ unsafe } as never) as unknown as {
			unsafe: (statement: string, parameters?: unknown[]) => FakeQuery;
		},
		unsafe,
	};
}

beforeEach(() => {
	getRequestEvent.mockReset();
});

describe('database query timing', () => {
	it('records a query awaited through values() once and keeps its result', async () => {
		const event = createTimedRequest();
		const query = new FakeQuery();
		const { database, unsafe } = databaseClientReturning(query);

		const rows = await database.unsafe('select name from "user"', []).values();

		expect(rows).toEqual([['Martin']]);
		expect(unsafe).toHaveBeenCalledWith('select name from "user"', [], { prepare: true });
		expect(query.executions).toBe(1);
		expect(serverTimingHeader(event, 10)).toMatch(/^db;dur=\d+\.\d;desc="1 query", total/);
	});

	it('records a query once however often it is awaited', async () => {
		const event = createTimedRequest();
		const { database } = databaseClientReturning(new FakeQuery());

		const query = database.unsafe('select 1');
		await query;
		await query.finally(() => undefined);
		await query.then((rows) => rows);

		expect(serverTimingHeader(event, 10)).toContain('desc="1 query"');
	});

	it('records a failed query once and keeps its rejection for catch', async () => {
		const event = createTimedRequest();
		const failure = new Error('connection reset');
		const { database } = databaseClientReturning(new FakeQuery(failure));

		const caught = await database.unsafe('select 1').catch((reason: unknown) => reason);

		expect(caught).toBe(failure);
		expect(serverTimingHeader(event, 10)).toContain('desc="1 query"');
	});

	it('counts each query of a request', async () => {
		const event = createTimedRequest();
		const unsafe = vi.fn(() => new FakeQuery());
		const database = withPreparedStatements({ unsafe } as never) as unknown as {
			unsafe: (statement: string) => FakeQuery;
		};

		await Promise.all([database.unsafe('select 1'), database.unsafe('select 2').values()]);

		expect(serverTimingHeader(event, 10)).toContain('desc="2 queries"');
	});
});
