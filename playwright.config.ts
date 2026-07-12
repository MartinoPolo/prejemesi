import { defineConfig, devices } from '@playwright/test';

// Overridable so parallel git worktrees don't reuse each other's dev server
// (reuseExistingServer would silently test the wrong checkout).
const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	workers: 4,
	use: {
		baseURL: `http://localhost:${port}`,
		trace: 'on-first-retry',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	webServer: {
		// No `--` separator: pnpm forwards it verbatim and vite would treat the flags as positionals.
		command: `pnpm run dev --port ${port} --strictPort`,
		port,
		reuseExistingServer: true,
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
