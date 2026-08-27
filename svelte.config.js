import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';

const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		},
		experimental: {
			// enables `await` directly in components without {#await} blocks
			async: true,
		},
	},
	kit: {
		// Browser tests use SvelteKit's aliases and transforms, but never build
		// for Cloudflare. Avoid starting Miniflare during their Vite lifecycle.
		adapter: isVitest ? undefined : adapter(),
		experimental: {
			// type-safe client-server functions that always run on the server
			remoteFunctions: true,
		},
	},
	vitePlugin: {
		// https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/inspector.md
		inspector: {
			toggleKeyCombo: 'alt-x',
			showToggleButton: 'active',
		},
	},
};

export default config;
