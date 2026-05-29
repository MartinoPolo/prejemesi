import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';

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
		adapter: adapter(),
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
