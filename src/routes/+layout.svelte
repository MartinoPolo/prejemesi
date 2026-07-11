<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { AppToaster } from '$lib/components/base/toast/index.js';
	import favicon from '$lib/assets/favicon.svg';
	import dynapuffLatinUrl from '@fontsource-variable/dynapuff/files/dynapuff-latin-wght-normal.woff2?url';
	import geistLatinUrl from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url';
	import { afterNavigate, preloadCode } from '$app/navigation';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { getLocaleForUrl, getTextDirection } from '$lib/paraglide/runtime.js';

	// Dev-only tab title prefix – injected at dev-server start from git branch (vite.config.ts define).
	// Lets you tell apart multiple worktrees/branches running simultaneously in the browser.
	// Gated on `dev` so production builds never show a branch tag (e.g. "[dev]").
	function shortBranch(full: string): string {
		const stripped = full.replace(/^[^/]+\//, ''); // strip feature/, fix/, etc.
		return stripped.split(/[-_]/).slice(0, 2).join('-'); // first two segments
	}

	let { children } = $props();
	const currentLocale = $derived(getLocaleForUrl(page.url.href));
	const currentTextDirection = $derived(getTextDirection(currentLocale));

	$effect(() => {
		if (browser) {
			document.documentElement.lang = currentLocale;
			document.documentElement.dir = currentTextDirection;
		}
	});

	// afterNavigate fires after SvelteKit applies <svelte:head><title> from the page,
	// so we can safely prepend without the page overwriting us again.
	// Port is read here (browser-only) so each worktree's port is included.
	afterNavigate(() => {
		if (dev && document.title && !document.title.startsWith('[')) {
			const branch = shortBranch(__GIT_BRANCH__);
			const port = window.location.port;
			const prefix = port ? `[${branch}:${port}]` : `[${branch}]`;
			document.title = `${prefix} ${document.title}`;
		}
	});

	if (browser) {
		const primaryRoutes = [
			'/my-lists',
			'/moderated',
			'/followed',
			'/settings',
			'/login',
			'/register',
		];
		Promise.allSettled(primaryRoutes.map((route) => preloadCode(route)));
	}
</script>

<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link
		rel="preload"
		href={dynapuffLatinUrl}
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link rel="preload" href={geistLatinUrl} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{#key currentLocale}
	{@render children()}
{/key}

<AppToaster />
