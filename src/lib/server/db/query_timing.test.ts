import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getRequestEvent = vi.hoisted(() => vi.fn<() => RequestEvent>());

vi.mock('$app/server', () => ({ getRequestEvent }));

const { withPreparedStatements } = await import('./index.js');
const { serverTimingHeader, startServerTiming, stopServerTiming } =
	await import('../server_timing.js');

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

const timedEvents: RequestEvent[] = [];

function createTimedRequest(): RequestEvent {
	const event = { locals: {} } as RequestEvent;
	startServerTiming(event);
	timedEvents.push(event);
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

interface FakeTransactionScope {
	unsafe: (statement: string, parameters?: unknown[], options?: object) => FakeQuery;
	savepoint: <T>(callback: (scope: FakeTransactionScope) => Promise<T>) => Promise<T>;
}

/**
 * Mirrors postgres.js transactions: `begin` and `savepoint` hand their callback a scoped client and
 * send the transaction-control statements themselves, never through the wrapped `unsafe`.
 */
function createTransactionalClient(createQuery = () => new FakeQuery()) {
	const statementLog: string[] = [];
	const unsafe = vi.fn((statement: string) => {
		statementLog.push(statement);
		return createQuery();
	});
	const createScope = (): FakeTransactionScope => ({
		unsafe,
		async savepoint(callback) {
			statementLog.push('SAVEPOINT');
			const result = await callback(createScope());
			statementLog.push('RELEASE SAVEPOINT');
			return result;
		},
	});
	const client = {
		unsafe,
		async begin<T>(options: string, callback: (scope: FakeTransactionScope) => Promise<T>) {
			statementLog.push(`BEGIN ${options}`);
			const result = await callback(createScope());
			statementLog.push('COMMIT');
			return result;
		},
	};
	return {
		database: withPreparedStatements(client as never) as unknown as typeof client,
		statementLog,
		unsafe,
	};
}

beforeEach(() => {
	getRequestEvent.mockReset();
});

afterEach(() => {
	for (const event of timedEvents.splice(0)) {
		stopServerTiming(event);
	}
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

	it('times queries inside a transaction and its savepoint, but not the control statements', async () => {
		const event = createTimedRequest();
		const { database, statementLog, unsafe } = createTransactionalClient();

		const result = await database.begin('read write', async (transaction) => {
			await transaction.unsafe('insert into gift values ($1)', ['first']);
			return transaction.savepoint(async (savepoint) => {
				await savepoint.unsafe('insert into gift values ($1)', ['second']).values();
				return 'committed';
			});
		});

		expect(result).toBe('committed');
		expect(statementLog).toEqual([
			'BEGIN read write',
			'insert into gift values ($1)',
			'SAVEPOINT',
			'insert into gift values ($1)',
			'RELEASE SAVEPOINT',
			'COMMIT',
		]);
		expect(unsafe).toHaveBeenNthCalledWith(1, 'insert into gift values ($1)', ['first'], {
			prepare: true,
		});
		expect(unsafe).toHaveBeenNthCalledWith(2, 'insert into gift values ($1)', ['second'], {
			prepare: true,
		});
		expect(serverTimingHeader(event, 10)).toContain('desc="2 queries"');
	});

	it('times a failed query inside a savepoint and keeps its rejection', async () => {
		const event = createTimedRequest();
		const failure = new Error('unique violation');
		const { database } = createTransactionalClient(() => new FakeQuery(failure));

		await expect(
			database.begin('read write', (transaction) =>
				transaction.savepoint(async (savepoint) => savepoint.unsafe('insert into gift')),
			),
		).rejects.toBe(failure);

		expect(serverTimingHeader(event, 10)).toContain('desc="1 query"');
	});
});
