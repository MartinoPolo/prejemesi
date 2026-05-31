import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	retries: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	workers: 4,
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	webServer: {
		command: 'pnpm run dev',
		port: 5173,
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
