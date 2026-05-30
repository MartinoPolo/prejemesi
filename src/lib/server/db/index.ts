import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import * as schema from './schema.js';

export function isDatabaseConfigured(): boolean {
	return env.DATABASE_URL !== undefined && env.DATABASE_URL !== '';
}

export function getDb() {
	const event = getRequestEvent();
	const connectionString: string | undefined =
		(event?.platform?.env?.HYPERDRIVE?.connectionString as string | undefined) ??
		env.DATABASE_URL;

	if (connectionString === undefined || connectionString === '') {
		throw new Error('No database connection: set DATABASE_URL or configure Hyperdrive');
	}

	const client = postgres(connectionString, {
		prepare: false,
		fetch_types: false,
	});

	return drizzle(client, { schema });
}
