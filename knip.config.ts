import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	entry: [
		'src/hooks.ts',
		'src/lib/auth_client.ts',
		'src/lib/reactivity/*.svelte.ts',
		'src/lib/context/*.context.svelte.ts',
		'src/lib/components/ui/*/index.ts',
	],
	project: ['src/**/*.{ts,svelte}'],
	ignoreDependencies: [
		'@typescript-eslint/parser',
		'@node-rs/argon2',
		'@fontsource-variable/figtree',
		'@fontsource-variable/noto-sans',
		'shadcn-svelte',
		'tw-animate-css',
		'vitest-browser-svelte',
	],
};

export default config;
