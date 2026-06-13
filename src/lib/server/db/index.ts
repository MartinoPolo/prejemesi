import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';
import * as schema from './schema.js';

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
		(env.DATABASE_URL !== undefined && env.DATABASE_URL !== '')
	);
}

function createDb(connectionString: string) {
	const client = postgres(connectionString, {
		prepare: false,
		fetch_types: false,
		// Bound the pool and reap idle/old connections. Without idle_timeout
		// (postgres-js default is 0 = never close), pools orphaned by Vite HMR
		// re-evaluation in dev keep their backends open forever, eventually
		// exhausting Postgres ("too many clients already", 53300).
		max: 10,
		idle_timeout: 20,
		max_lifetime: 60 * 30,
	});
	return drizzle(client, { schema });
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

export function getDb(event?: RequestEvent) {
	let requestEvent: RequestEvent | undefined;
	try {
		requestEvent = event ?? getRequestEvent();
	} catch {
		requestEvent = undefined;
	}

	const hyperdriveConnectionString = getHyperdriveConnectionString(requestEvent);
	const connectionString =
		hyperdriveConnectionString ?? runtimeConnectionString ?? env.DATABASE_URL;

	if (connectionString === undefined || connectionString === '') {
		throw new Error('No database connection: set DATABASE_URL or configure Hyperdrive');
	}

	// On Workers (Hyperdrive binding present) the socket cannot cross requests,
	// so memoize per request rather than process-globally.
	if (requestEvent !== undefined && hyperdriveConnectionString !== undefined) {
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
