const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SHARED_DEVELOPMENT_DATABASE_PATH = '/local';

/**
 * Database-backed demo suites run only after `DEMO_TEST_ISOLATED_DATABASE=1`. Once opted in, a
 * misconfigured URL fails loudly instead of silently skipping the suite, and a non-local database
 * is never opened. Returns `null` when the suite was not opted in.
 */
export function resolveIsolatedDemoTestDatabaseUrl(
	databaseUrlVariableName: 'DEMO_TEST_DATABASE_URL' | 'DATABASE_URL',
	options: { allowSharedDevelopmentDatabase: boolean },
): string | null {
	if (process.env.DEMO_TEST_ISOLATED_DATABASE !== '1') {
		return null;
	}
	const databaseUrl = process.env[databaseUrlVariableName] ?? '';
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(databaseUrl);
	} catch {
		throw new Error(
			`DEMO_TEST_ISOLATED_DATABASE=1 requires ${databaseUrlVariableName} to be a valid local PostgreSQL URL`,
		);
	}
	if (!LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname) || parsedUrl.pathname.length <= 1) {
		throw new Error(
			`DEMO_TEST_ISOLATED_DATABASE=1 requires ${databaseUrlVariableName} to name a database on localhost`,
		);
	}
	if (
		!options.allowSharedDevelopmentDatabase &&
		parsedUrl.pathname === SHARED_DEVELOPMENT_DATABASE_PATH
	) {
		throw new Error(
			`${databaseUrlVariableName} must point at a separately migrated database, not the shared "local" database`,
		);
	}
	return databaseUrl;
}
