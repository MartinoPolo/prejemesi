import { loadEnv } from 'vite';
import { resolveDatabaseUrl } from '../../../src/lib/config/runtime_environment.js';

const LOCAL_DATABASE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The dev server's database URL, refusing anything but a local database. */
export function localDatabaseUrl(purpose: string): string {
	const databaseUrl = resolveDatabaseUrl({
		...loadEnv('development', process.cwd(), ''),
		...process.env,
	});
	if (databaseUrl === undefined || !LOCAL_DATABASE_HOSTNAMES.has(new URL(databaseUrl).hostname)) {
		throw new Error(`${purpose} on a local database only`);
	}
	return databaseUrl;
}
