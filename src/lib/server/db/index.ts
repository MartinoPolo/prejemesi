import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema.js';

export function isDatabaseConfigured(): boolean {
	return env.DATABASE_URL !== undefined && env.DATABASE_URL !== '';
}

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
	if (!_db) {
		if (!isDatabaseConfigured()) {
			throw new Error('DATABASE_URL environment variable is required');
		}
		const client = postgres(env.DATABASE_URL!);
		_db = drizzle(client, { schema });
	}
	return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_, prop) {
		return Reflect.get(getDb(), prop);
	},
});
