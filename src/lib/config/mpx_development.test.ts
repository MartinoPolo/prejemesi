import { describe, expect, it } from 'vitest';
import {
	resolveAuthOrigins,
	resolveDatabaseUrl,
	resolveDevelopmentEnvironment,
} from './mpx_development.js';

describe('MPX development environment', () => {
	it('consumes MPX service URL assignments without falling back to preferred ports', () => {
		const resolved = resolveDevelopmentEnvironment({
			MPX_APP_URL: 'http://localhost:8405',
			MPX_PREVIEW_URL: 'http://localhost:8406',
			MPX_STORYBOOK_URL: 'http://localhost:8407',
			MPX_VITEST_CLIENT_URL: 'http://localhost:8408',
			MPX_VITEST_STORYBOOK_URL: 'http://localhost:8409',
		});

		expect(resolved).toMatchObject({
			appPort: 8405,
			appOrigin: 'http://localhost:8405',
			origin: 'http://localhost:8405',
			previewPort: 8406,
			previewOrigin: 'http://localhost:8406',
			storybookPort: 8407,
			vitestClientPort: 8408,
			vitestStorybookPort: 8409,
		});
	});

	it('accepts URL values injected into the configured MPX port variables', () => {
		const resolved = resolveDevelopmentEnvironment({
			MPX_APP_PORT: 'http://localhost:8505',
			MPX_PREVIEW_PORT: 'http://localhost:8506',
		});

		expect(resolved.appPort).toBe(8505);
		expect(resolved.previewPort).toBe(8506);
		expect(resolved.origin).toBe('http://localhost:8505');
	});

	it('couples app-dependent URLs to the injected app port', () => {
		const resolved = resolveDevelopmentEnvironment({
			MPX_APP_PORT: '8405',
			MPX_PREVIEW_PORT: '8406',
			MPX_STORYBOOK_PORT: '8407',
			MPX_VITEST_CLIENT_PORT: '8408',
			MPX_VITEST_STORYBOOK_PORT: '8409',
			ORIGIN: 'http://localhost:5173',
		});

		expect(resolved).toMatchObject({
			appPort: 8405,
			appOrigin: 'http://localhost:8405',
			origin: 'http://localhost:8405',
			playwrightBaseUrl: 'http://localhost:8405',
			loadTestLocalTarget: 'http://localhost:8405',
			previewOrigin: 'http://localhost:8406',
			storybookPort: 8407,
			vitestClientPort: 8408,
			vitestStorybookPort: 8409,
			r2LocalOrigins: ['http://localhost:8405', 'http://localhost:8406'],
		});
	});

	it('uses localhost for the assigned development app host and Better Auth origin', () => {
		const environment = { MPX_APP_PORT: '8410' };

		expect(resolveDevelopmentEnvironment(environment)).toMatchObject({
			appOrigin: 'http://localhost:8410',
			appServer: { host: 'localhost', port: 8410 },
		});
		expect(resolveAuthOrigins(environment, true)).toEqual({
			baseURL: 'http://localhost:8410',
			trustedOrigins: ['http://localhost:8410'],
		});
	});

	it('keeps Better Auth aligned with the development server instead of a stale ORIGIN', () => {
		expect(resolveAuthOrigins({ ORIGIN: 'http://localhost:5173' }, true)).toEqual({
			baseURL: 'http://localhost:8300',
			trustedOrigins: ['http://localhost:8300'],
		});
	});

	it('derives the shared database identity from the MPX TCP assignment', () => {
		expect(resolveDatabaseUrl({ MPX_DATABASE_PORT: 'tcp://localhost:5432' })).toBe(
			'postgres://root:mysecretpassword@localhost:5432/local',
		);
	});

	it('keeps the main checkout and linked worktrees on one project database identity', () => {
		const main = resolveDatabaseUrl({ MPX_APP_PORT: '8300', MPX_DATABASE_PORT: '5432' });
		const worktree = resolveDatabaseUrl({ MPX_APP_PORT: '8305', MPX_DATABASE_PORT: '5432' });

		expect(worktree).toBe(main);
		expect(main).toBe('postgres://root:mysecretpassword@localhost:5432/local');
	});
});
