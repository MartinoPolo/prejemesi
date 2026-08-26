import { describe, expect, it } from 'vitest';
import {
	resolveAuthOrigins,
	resolveDatabaseUrl,
	resolveDevelopmentEnvironment,
} from './mpx_development.js';

describe('MPX development environment', () => {
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

	it('uses the assigned app origin for Better Auth base and trusted origins', () => {
		expect(resolveAuthOrigins({ MPX_APP_PORT: '8410' }, true)).toEqual({
			baseURL: 'http://localhost:8410',
			trustedOrigins: ['http://localhost:8410'],
		});
	});

	it('keeps the main checkout and linked worktrees on one project database identity', () => {
		const main = resolveDatabaseUrl({ MPX_APP_PORT: '8300', MPX_DATABASE_PORT: '5432' });
		const worktree = resolveDatabaseUrl({ MPX_APP_PORT: '8305', MPX_DATABASE_PORT: '5432' });

		expect(worktree).toBe(main);
		expect(main).toBe('postgres://root:mysecretpassword@localhost:5432/local');
	});
});
