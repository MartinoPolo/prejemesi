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
		reuseExistingServer: true,
		env: {
			// The app administrator is env-based (`isAppAdmin`), so the admin-only specs
			// (revert-to-draft #150, release reservation #213) need a known operator address.
			// NOTE: `reuseExistingServer` means an ALREADY RUNNING dev server keeps whatever
			// env it was started with — restart it if those specs fail with a missing control.
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
