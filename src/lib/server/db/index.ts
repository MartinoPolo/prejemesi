import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';
import * as schema from './schema.js';
import { resolveDatabaseUrl } from '$lib/config/runtime_environment.js';
import { MAX_OPERATION_BATCH_STEPS } from '$lib/server/operations/constants.js';

function getHyperdriveConnectionString(event: RequestEvent | undefined): string | undefined {
	return event?.platform?.env?.HYPERDRIVE?.connectionString as string | undefined;
}

let runtimeConnectionString: string | undefined;

export function rememberDatabaseBinding(event: RequestEvent): void {
	const hyperdriveConnectionString = getHyperdriveConnectionString(event);
	if (hyperdriveConnectionString !== undefined && hyperdriveConnectionString !== '') {
		runtimeConnectionString = hyperdriveConnectionString;
	}
}

export function isDatabaseConfigured(event?: RequestEvent): boolean {
	const hyperdriveConnectionString = getHyperdriveConnectionString(event);
	return (
		(hyperdriveConnectionString !== undefined && hyperdriveConnectionString !== '') ||
		(runtimeConnectionString !== undefined && runtimeConnectionString !== '') ||
		resolveDatabaseUrl(env) !== undefined
	);
}

type PostgresClient = ReturnType<typeof postgres>;

/**
 * Makes every statement Drizzle sends a named prepared statement, in transactions and savepoints
 * too. Drizzle sends through `unsafe`, which postgres.js leaves unprepared; an unprepared statement
 * with parameters waits a round trip to describe them before it runs, so it costs two round trips
 * and cannot be pipelined. Hyperdrive supports postgres.js's named prepared statements and warns
 * that unprepared ones can hang in its transaction pooling. The client must enable `prepare` too:
 * a connection without it ignores the per-statement option.
 */
function withPreparedStatements<TClient extends Pick<PostgresClient, 'unsafe'>>(
	client: TClient,
): TClient {
	return new Proxy(client, {
		get(target, property, receiver) {
			if (property === 'unsafe') {
				return (query: string, parameters?: never[], options?: object) =>
					target.unsafe(query, parameters, { prepare: true, ...options });
			}
			if (property === 'begin' || property === 'savepoint') {
				return (...parameters: unknown[]) => {
					const method: unknown = Reflect.get(target, property, target);
					const callback = parameters.pop();
					if (typeof method !== 'function' || typeof callback !== 'function') {
						throw new TypeError(`postgres ${property} needs a callback`);
					}
					return Reflect.apply(method, target, [
						...parameters,
						(scoped: Pick<PostgresClient, 'unsafe'>) =>
							callback(withPreparedStatements(scoped)),
					]);
				};
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

/**
 * postgres.js reads `max_pipeline` but leaves it out of its option types. Statements queued beyond
 * that many in flight go one round trip each, and a batch runs that many steps together, each with
 * one statement in flight at a time.
 */
const pipelineOptions: { max_pipeline: number } = { max_pipeline: MAX_OPERATION_BATCH_STEPS };

function createDb(connectionString: string) {
	const client = postgres(connectionString, {
		...pipelineOptions,
		prepare: true,
		fetch_types: false,
		// Bound the pool and reap idle/old connections. Without idle_timeout
		// (postgres-js default is 0 = never close), pools orphaned by Vite HMR
		// re-evaluation in dev keep their backends open forever, eventually
		// exhausting Postgres ("too many clients already", 53300).
		max: 10,
		idle_timeout: 20,
		max_lifetime: 60 * 30,
	});
	return drizzle(withPreparedStatements(client), { schema });
}

/**
 * Process-global cache for non-request contexts (seed scripts, migrations) and
 * for the Node dev runtime, where a connection may be safely reused across
 * requests.
 *
 * Pinned to `globalThis` so it survives Vite HMR module re-evaluation in dev:
 * a plain module-level Map is recreated on every server-file edit, abandoning
 * the previous postgres pool and leaking its open connections. Reusing the
 * global keeps a single pool alive across reloads.
 */
const globalCacheKey = Symbol.for('prejemesi.db.globalClientCache');
const globalCacheHost = globalThis as typeof globalThis & {
	[globalCacheKey]?: Map<string, ReturnType<typeof drizzle>>;
};
const globalClientCache: Map<string, ReturnType<typeof drizzle>> = globalCacheHost[
	globalCacheKey
] ?? (globalCacheHost[globalCacheKey] = new Map());

/**
 * Per-request cache for the Cloudflare Workers runtime. On Workers the postgres
 * socket is request-scoped: an I/O object created in one request handler cannot
 * be used by another ("Cannot perform I/O on behalf of a different request").
 * Keying by the request event gives each request its own socket and lets it be
 * collected when the request ends.
 */
const requestClientCache = new WeakMap<RequestEvent, ReturnType<typeof drizzle>>();

type Database = ReturnType<typeof drizzle>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Scoped to one request; installed only after auth and removed before the request ends. */
export function withRequestDatabaseTransaction<T>(
	event: RequestEvent,
	transaction: DatabaseTransaction,
	work: () => Promise<T>,
): Promise<T> {
	if (event.locals.demoDatabaseTransaction) {
		throw new Error('Demo transaction already active');
	}
	event.locals.demoDatabaseTransaction = transaction;
	return work().finally(() => {
		delete event.locals.demoDatabaseTransaction;
	});
}

export function getDb(event?: RequestEvent) {
	let requestEvent: RequestEvent | undefined;
	try {
		requestEvent = event ?? getRequestEvent();
	} catch {
		requestEvent = undefined;
	}

	if (requestEvent?.locals.demoDatabaseTransaction) {
		// Transaction implements the query/transaction API; its only missing DB surface is $client.
		return requestEvent.locals.demoDatabaseTransaction as unknown as Database;
	}

	const hyperdriveConnectionString = getHyperdriveConnectionString(requestEvent);
	const connectionString =
		hyperdriveConnectionString ?? runtimeConnectionString ?? resolveDatabaseUrl(env);

	if (connectionString === undefined || connectionString === '') {
		throw new Error('No database connection: set DATABASE_URL or configure Hyperdrive');
	}

	// On the real Cloudflare Workers runtime the postgres socket is request-scoped
	// (an I/O object created in one request handler cannot be used by another:
	// "Cannot perform I/O on behalf of a different request"), so memoize per request.
	//
	// In `vite dev` the Cloudflare adapter's platformProxy ALSO exposes the
	// Hyperdrive binding (against compose.yaml's local Postgres), but dev is a
	// long-lived Node process where a socket is freely reused across requests.
	// Without the `!DEV` guard, dev would create a fresh pool per request and
	// exhaust Postgres ("too many clients already", 53300) under any concurrency.
	if (
		!import.meta.env.DEV &&
		requestEvent !== undefined &&
		hyperdriveConnectionString !== undefined
	) {
		const cached = requestClientCache.get(requestEvent);
		if (cached !== undefined) {
			return cached;
		}
		const db = createDb(connectionString);
		requestClientCache.set(requestEvent, db);
		return db;
	}

	const cached = globalClientCache.get(connectionString);
	if (cached !== undefined) {
		return cached;
	}
	const db = createDb(connectionString);
	globalClientCache.set(connectionString, db);
	return db;
}

/**
 * Closes all cached postgres-js connections. Intended for test teardown so the
 * pooled client does not keep the process (or vitest) alive after the suite ends.
 */
export async function closeDb(): Promise<void> {
	await Promise.all([...globalClientCache.values()].map((db) => db.$client.end()));
	globalClientCache.clear();
}
