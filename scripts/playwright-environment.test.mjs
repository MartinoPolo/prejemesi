import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaywrightServer } from './playwright-environment.mjs';

const databaseUrl = 'postgres://root:local-password@localhost:5432/e2e_shared';

function resolve(environment = {}, overrides = {}) {
	return resolvePlaywrightServer({ environment, databaseUrl, ...overrides });
}

test('PLAYWRIGHT_BASE_URL is authoritative and defaults to the preferred app port', () => {
	assert.equal(resolve().origin, 'http://localhost:8300');
	const custom = resolve({ PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:8456' });
	assert.equal(custom.origin, 'http://127.0.0.1:8456');
	assert.equal(custom.port, 8456);
});

test('the explicit Playwright origin is strict loopback HTTP with a port', () => {
	for (const invalid of [
		'https://localhost:8300',
		'http://localhost',
		'http://user:secret@localhost:8300',
		'http://localhost:8300/path',
		'http://evil.example:8300',
	]) {
		assert.throws(() => resolve({ PLAYWRIGHT_BASE_URL: invalid }), /PLAYWRIGHT_BASE_URL/);
	}
});

test('external server use requires explicit opt-in and exact URL matching', () => {
	assert.equal(resolve({ PLAYWRIGHT_EXTERNAL_SERVER: '1' }).external, true);
	assert.throws(
		() =>
			resolve(
				{ PLAYWRIGHT_EXTERNAL_SERVER: '1', PLAYWRIGHT_BASE_URL: 'http://localhost:8400' },
				{ externalServerUrl: 'http://localhost:8401' },
			),
		/exactly match/,
	);
});

test('automation uses the exact local database and blanks remote services', () => {
	const server = resolve({
		AUTH_SECRET: 'explicit-local-signing-secret',
		R2_ACCESS_KEY_ID: 'remote',
		RESEND_API_KEY: 'remote',
	});
	assert.equal(server.environment.DATABASE_URL, databaseUrl);
	assert.equal(
		server.environment.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE,
		databaseUrl,
	);
	assert.equal(server.environment.AUTH_SECRET, 'explicit-local-signing-secret');
	assert.equal(server.environment.ORIGIN, server.origin);
	assert.equal(server.environment.ADMIN_EMAILS, 'tomas@test.cz');
	assert.equal(server.environment.BROWSER, 'none');
	for (const name of [
		'R2_ACCOUNT_ID',
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY',
		'PUBLIC_R2_URL',
		'RESEND_API_KEY',
		'EMAIL_FROM',
	]) {
		assert.equal(server.environment[name], '');
	}
});

test('automation refuses a remote database', () => {
	assert.throws(
		() => resolve({}, { databaseUrl: 'postgres://user:secret@example.com/app' }),
		/loopback/,
	);
});
