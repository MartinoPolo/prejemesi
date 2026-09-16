import { resolveDynamicBaseURL } from 'better-auth';
import { describe, expect, it } from 'vitest';
import {
	resolveApplicationOrigin,
	resolveAuthOrigins,
	resolveDatabaseUrl,
	resolveRuntimeEnvironment,
} from './runtime_environment.js';

describe('runtime environment', () => {
	it('uses conventional local services and distinct strict Vitest ports', () => {
		expect(resolveRuntimeEnvironment({})).toEqual({
			previewOrigin: 'http://localhost:4173',
			loadTestLocalTarget: 'http://localhost:8300',
			vitestClientPort: 8310,
			vitestStorybookPort: 8311,
			r2LocalOrigins: [
				'http://localhost:8300',
				'http://localhost:8301',
				'http://localhost:8302',
				'http://localhost:8303',
				'http://localhost:8304',
				'http://localhost:4173',
			],
		});
	});

	it('treats empty optional environment values as unset', () => {
		expect(resolveRuntimeEnvironment({ LOADTEST_LOCAL_URL: '' }).loadTestLocalTarget).toBe(
			'http://localhost:8300',
		);
		expect(resolveAuthOrigins({ ORIGIN: '' }, false).baseURL).toBe('http://localhost:8300');
		expect(resolveApplicationOrigin({ ORIGIN: '' }, false)).toBe('http://localhost:8300');
	});

	it('accepts only valid purpose-specific Vitest ports', () => {
		expect(
			resolveRuntimeEnvironment({
				VITEST_CLIENT_PORT: '8400',
				VITEST_STORYBOOK_PORT: '8401',
			}),
		).toMatchObject({ vitestClientPort: 8400, vitestStorybookPort: 8401 });
		expect(() => resolveRuntimeEnvironment({ VITEST_CLIENT_PORT: 'not-a-port' })).toThrow(
			/VITEST_CLIENT_PORT/,
		);
		expect(() =>
			resolveRuntimeEnvironment({
				VITEST_CLIENT_PORT: '8400',
				VITEST_STORYBOOK_PORT: '8400',
			}),
		).toThrow(/distinct/);
	});

	it('uses dynamic loopback HTTP auth in development without trusting proxy headers', () => {
		expect(
			resolveAuthOrigins({ BETTER_AUTH_TRUSTED_ORIGINS: 'https://trusted.example' }, true),
		).toEqual({
			baseURL: {
				allowedHosts: ['localhost:*', '127.0.0.1:*', '[::1]:*'],
				protocol: 'http',
			},
			trustedOrigins: ['https://trusted.example'],
			trustedProxyHeaders: false,
		});
	});

	it('resolves Better Auth against arbitrary loopback ports and rejects other hosts', () => {
		const baseURL = resolveAuthOrigins({}, true).baseURL;
		if (typeof baseURL === 'string') {
			throw new Error('Expected dynamic development auth configuration.');
		}
		expect(
			resolveDynamicBaseURL(
				baseURL,
				new Request('http://localhost:8456/api/auth/sign-in/email'),
				'/api/auth',
				false,
			),
		).toBe('http://localhost:8456/api/auth');
		expect(() =>
			resolveDynamicBaseURL(
				baseURL,
				new Request('http://evil.example:8456/api/auth/sign-in/email'),
				'/api/auth',
				false,
			),
		).toThrow(/not in the allowed hosts list/);
	});

	it('keeps production auth and background links fixed to configured ORIGIN', () => {
		const environment = { ORIGIN: 'https://prejemesi.cz' };
		expect(resolveAuthOrigins(environment, false).baseURL).toBe('https://prejemesi.cz');
		expect(resolveApplicationOrigin(environment, false, 'http://localhost:8302/path')).toBe(
			'https://prejemesi.cz',
		);
	});

	it('captures an initiating loopback HTTP origin in development and rejects unsafe origins', () => {
		expect(resolveApplicationOrigin({}, true, 'http://127.0.0.1:8456/path')).toBe(
			'http://127.0.0.1:8456',
		);
		expect(resolveApplicationOrigin({}, true, 'https://localhost:8456/path')).toBe(
			'http://localhost:8300',
		);
		expect(resolveApplicationOrigin({}, true, 'http://evil.example:8456/path')).toBe(
			'http://localhost:8300',
		);
	});

	it('keeps DATABASE_URL authoritative and MPX database compatibility narrow', () => {
		expect(
			resolveDatabaseUrl({
				DATABASE_URL: 'postgres://authoritative/database',
				MPX_DATABASE_URL: 'tcp://localhost:5444',
			}),
		).toBe('postgres://authoritative/database');
		expect(resolveDatabaseUrl({ MPX_DATABASE_PORT: 'tcp://localhost:5432' })).toBe(
			'postgres://root:mysecretpassword@localhost:5432/local',
		);
	});
});
