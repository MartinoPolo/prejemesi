import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loadEnv } from 'vite';
import { resolveDatabaseUrl } from './src/lib/config/runtime_environment.js';
import { sharedBrowserTestLaunchOptions } from './scripts/browser-automation.mjs';
import { resolvePlaywrightServer } from './scripts/playwright-environment.mjs';

const environment = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const databaseUrl = resolveDatabaseUrl(environment);
if (!databaseUrl) {
	throw new Error(
		'Prepare a seeded local E2E database and set DATABASE_URL before running Playwright.',
	);
}
const server = resolvePlaywrightServer({ environment, databaseUrl });
// Workers inherit this from the runner process; tests/release/interaction/support/run-fixture.ts
// keys its shared files by it so one run never reads another run's fixtures.
process.env.PLAYWRIGHT_RUN_ID ??= randomUUID();

export default defineConfig({
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
	timeout: 60_000,
	preserveOutput: process.env.UPDATE_HOVER_EVIDENCE === '1' ? 'always' : 'failures-only',
	expect: { timeout: 10_000 },
	workers: 2,
	use: {
		...sharedBrowserTestLaunchOptions,
		baseURL: server.origin,
		trace: 'on-first-retry',
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
	},
	webServer: server.external
		? undefined
		: {
				command: `pnpm exec vite dev --host localhost --port ${server.port} --strictPort`,
				url: server.origin,
				timeout: 120_000,
				reuseExistingServer: false,
				env: server.environment,
			},
	// Test tiers: docs/TESTING.md#test-tiers.
	projects: [
		{
			name: 'setup',
			testDir: 'tests/e2e',
			testMatch: /global-setup\.spec\.ts/,
		},
		{
			name: 'chromium',
			testDir: 'tests/e2e',
			testIgnore: /global-setup\.spec\.ts/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},
		{
			name: 'release',
			testDir: 'tests/release',
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['setup'],
		},
	],
});
