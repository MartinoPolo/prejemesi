/**
 * Creates the dedicated load-test fixtures (idempotent).
 *
 * Usage: pnpm loadtest:setup
 * Target DB: LOADTEST_DATABASE_URL, else DATABASE_URL (non-local hosts require
 * the production guard env — see docs/LOAD_TESTING.md).
 */

import { assertDatabaseAuthorized, connectDb, resolveDatabaseUrl } from './db.js';
import { setupLoadTestData } from './fixtures.js';
import { LOADTEST_ID_PREFIX, MAX_VIRTUAL_USERS } from './config.js';

const databaseUrl = resolveDatabaseUrl();
if (databaseUrl === null) {
	console.error('DATABASE_URL (or LOADTEST_DATABASE_URL) is not set.');
	process.exit(1);
}
assertDatabaseAuthorized(databaseUrl);

console.log(`Setting up load-test fixtures on ${new URL(databaseUrl).host} …`);
const handle = connectDb(databaseUrl);
try {
	await setupLoadTestData(handle.db);
	console.log(
		`Done: 1 arena wishlist + ${String(MAX_VIRTUAL_USERS)} VU accounts/wishlists ` +
			`(all rows prefixed "${LOADTEST_ID_PREFIX}").`,
	);
} finally {
	await handle.close();
}
