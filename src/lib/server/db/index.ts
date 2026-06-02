import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import * as schema from './schema.js';

export function isDatabaseConfigured(): boolean {
	return env.DATABASE_URL !== undefined && env.DATABASE_URL !== '';
}

const clientCache = new Map<string, ReturnType<typeof drizzle>>();

export function getDb() {
	let connectionString: string | undefined;
	try {
		const event = getRequestEvent();
		connectionString =
			(event?.platform?.env?.HYPERDRIVE?.connectionString as string | undefined) ??
			env.DATABASE_URL;
	} catch {
		connectionString = env.DATABASE_URL;
	}

	if (connectionString === undefined || connectionString === '') {
		throw new Error('No database connection: set DATABASE_URL or configure Hyperdrive');
	}

	const cached = clientCache.get(connectionString);
	if (cached) {
		return cached;
	}

	const client = postgres(connectionString, {
		prepare: false,
		fetch_types: false,
	});

	const db = drizzle(client, { schema });
	clientCache.set(connectionString, db);
	return db;
}

/**
 * Closes all cached postgres-js connections. Intended for test teardown so the
 * pooled client does not keep the process (or vitest) alive after the suite ends.
 */
export async function closeDb(): Promise<void> {
	await Promise.all([...clientCache.values()].map((db) => db.$client.end()));
	clientCache.clear();
}
