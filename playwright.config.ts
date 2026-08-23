import { defineConfig, devices } from '@playwright/test';

// Override when port 5173 is held by another worktree's dev server
// (each worktree runs its own port): PLAYWRIGHT_DEV_SERVER_PORT=5199 playwright test
const devServerPort = Number(process.env.PLAYWRIGHT_DEV_SERVER_PORT ?? 5173);

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	workers: 4,
	use: {
		baseURL: `http://localhost:${devServerPort}`,
		trace: 'on-first-retry',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	webServer: {
		// No `--` separator: pnpm forwards it verbatim and vite would treat the flags as positionals.
		command: `pnpm run dev --port ${devServerPort} --strictPort`,
		port: devServerPort,
		// Never reuse a server that may lack the controlled local E2E environment.
		reuseExistingServer: false,
		env: {
			// Local E2E signing only; this deterministic fallback is not a production secret.
			AUTH_SECRET:
				process.env.AUTH_SECRET ??
				'local-e2e-only-auth-secret-never-use-in-production-2026',
			// Keep the test server origin pinned to its assigned localhost port.
			ORIGIN: `http://localhost:${devServerPort}`,
			// The app administrator is env-based (`isAppAdmin`), so the admin-only specs
			// (revert-to-draft #150, release reservation #213) need a known operator address.
			ADMIN_EMAILS: 'tomas@test.cz',
		},
	},
	projects: [
		{
			name: 'setup',
			testMatch: /global-setup\.spec\.ts/,
		},
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},
	],
});
