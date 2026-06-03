import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import devtoolsJson from 'vite-plugin-devtools-json';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Read current git branch at dev-server start so each worktree gets its own
// branch name baked in — consumed by +layout.svelte to prefix browser tab titles.
const gitBranch = (() => {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
	} catch {
		return 'local';
	}
})();

const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const isVitest = process.env.VITEST === 'true';

export default defineConfig({
	server: {
		open: true,
		warmup: isVitest
			? undefined
			: {
					clientFiles: [
						'./src/routes/(app)/my-lists/+page.svelte',
						'./src/routes/(app)/moderated/+page.svelte',
						'./src/routes/(app)/followed/+page.svelte',
						'./src/routes/(app)/settings/+page.svelte',
						'./src/routes/(auth)/login/+page.svelte',
						'./src/routes/(auth)/register/+page.svelte',
					],
				},
	},
	define: {
		// Exposed as __GIT_BRANCH__ global; consumed in +layout.svelte to prefix tab titles.
		__GIT_BRANCH__: JSON.stringify(gitBranch),
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
			urlPatterns: [
				{
					pattern: '/:path(.*)?',
					localized: [
						['en', '/en/:path(.*)?'],
						['cs', '/:path(.*)?'],
					],
				},
			],
		}),
		devtoolsJson(),
	],
	test: {
		passWithNoTests: true,
		expect: {
			requireAssertions: true,
		},
		coverage: {
			include: [
				'src/lib/modules/**/*.remote.ts',
				'src/lib/modules/gifts/gift_url.ts',
				'src/lib/modules/import/parse_tabular.ts',
				'src/lib/modules/import/detect_columns.ts',
				'src/lib/modules/import/sheets_link.ts',
				'src/lib/modules/uploads/upload.ts',
				'src/lib/server/remote.ts',
				'src/lib/server/crypto/**/*.ts',
			],
			exclude: ['**/*.test.ts', '**/*.stories.svelte'],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					// Retry once: browser-mode interaction tests can drop a simulated event
					// under CI load. Play functions already gate keystrokes on focus to fix
					// the root cause; this is a documented safety net so a single stray drop
					// in any story doesn't redden CI.
					retry: 1,
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
						// Fixed API port so the two browser projects (client + storybook) bind
						// distinct Vitest servers instead of racing for a default port when both
						// run under `test --coverage`.
						api: { host: '127.0.0.1', port: 5174, strictPort: false },
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
			{
				extends: true,
				plugins: [
					storybookTest({
						configDir: path.join(dirname, '.storybook'),
					}),
				],
				test: {
					name: 'storybook',
					// See the client project: retry once as a safety net for browser-mode
					// interaction flakiness; the real fix is in the story play functions.
					retry: 1,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }],
						api: { host: '127.0.0.1', port: 5175, strictPort: false },
					},
				},
			},
		],
	},
});
