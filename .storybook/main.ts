import type { StorybookConfig } from '@storybook/sveltekit';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs',
	],
	framework: '@storybook/sveltekit',
	viteFinal: (viteConfig) => {
		// `$env/dynamic/public` needs a SvelteKit server payload that Storybook
		// does not have, so its virtual module crashes at import in the browser.
		// Alias it to an empty-env stub – image helpers then use their local-dev
		// fallbacks (original URLs, same-origin upload paths). Issue #107.
		viteConfig.resolve ??= {};
		const alias = viteConfig.resolve.alias;
		const stubAlias = {
			find: /^\$env\/dynamic\/public$/,
			replacement: join(configDir, 'env-dynamic-public-stub.ts'),
		};
		viteConfig.resolve.alias = Array.isArray(alias)
			? [...alias, stubAlias]
			: [
					...Object.entries(alias ?? {}).map(([find, replacement]) => ({
						find,
						replacement: replacement as string,
					})),
					stubAlias,
				];
		return viteConfig;
	},
};

export default config;
