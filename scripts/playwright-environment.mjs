import { automatedServerEnvironment } from './browser-automation.mjs';
import { PREFERRED_APPLICATION_ORIGIN } from './local-development-ports.mjs';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function requirePlaywrightOrigin(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('PLAYWRIGHT_BASE_URL must be an exact loopback HTTP origin with a port.');
	}
	if (
		url.protocol !== 'http:' ||
		!LOOPBACK_HOSTNAMES.has(url.hostname) ||
		url.port === '' ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	) {
		throw new Error('PLAYWRIGHT_BASE_URL must be an exact loopback HTTP origin with a port.');
	}
	return url;
}

function requireLocalDatabase(databaseUrl) {
	const database = new URL(databaseUrl);
	if (
		!LOOPBACK_HOSTNAMES.has(database.hostname) ||
		!['postgres:', 'postgresql:'].includes(database.protocol)
	) {
		throw new Error('Playwright requires a loopback PostgreSQL database URL.');
	}
}

export function resolvePlaywrightServer({ environment, databaseUrl, externalServerUrl }) {
	const url = requirePlaywrightOrigin(
		environment.PLAYWRIGHT_BASE_URL ?? PREFERRED_APPLICATION_ORIGIN,
	);
	const origin = url.origin;
	const external = environment.PLAYWRIGHT_EXTERNAL_SERVER === '1';
	const expectedExternalUrl = externalServerUrl ?? environment.PLAYWRIGHT_EXTERNAL_SERVER_URL;
	if (
		external &&
		expectedExternalUrl !== undefined &&
		requirePlaywrightOrigin(expectedExternalUrl).origin !== origin
	) {
		throw new Error('External server URL must exactly match PLAYWRIGHT_BASE_URL.');
	}
	requireLocalDatabase(databaseUrl);

	return {
		origin,
		port: Number(url.port),
		external,
		environment: {
			...automatedServerEnvironment,
			DATABASE_URL: databaseUrl,
			CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
			AUTH_SECRET:
				environment.AUTH_SECRET ??
				'local-e2e-only-auth-secret-never-use-in-production-2026',
			ORIGIN: origin,
			ADMIN_EMAILS: 'tomas@test.cz',
			R2_ACCOUNT_ID: '',
			R2_ACCESS_KEY_ID: '',
			R2_SECRET_ACCESS_KEY: '',
			PUBLIC_R2_URL: '',
			RESEND_API_KEY: '',
			EMAIL_FROM: '',
		},
	};
}
