/**
 * Removes every load-test row (AC-7). Deletes only rows identified by the
 * `loadtest-` prefix or FK-linked to such rows — never real user data.
 *
 * Usage: pnpm loadtest:cleanup
 */

import { assertDatabaseAuthorized, connectDb, resolveDatabaseUrl } from './db.js';
import { cleanupLoadTestData } from './fixtures.js';

const databaseUrl = resolveDatabaseUrl();
if (databaseUrl === null) {
	console.error('DATABASE_URL (or LOADTEST_DATABASE_URL) is not set.');
	process.exit(1);
}
assertDatabaseAuthorized(databaseUrl);

console.log(`Cleaning load-test data on ${new URL(databaseUrl).host} …`);
const handle = connectDb(databaseUrl);
try {
	await cleanupLoadTestData(handle.db);
	console.log('Done — all loadtest rows removed.');
} finally {
	await handle.close();
}
