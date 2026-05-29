<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { setShowcaseFormContext } from '$lib/context/showcase_form.context.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import figtreeLatinUrl from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url';
	import notoSansLatinUrl from '@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2?url';
	import { afterNavigate } from '$app/navigation';

	// Tab title prefix — injected at dev-server start from git branch (vite.config.ts define).
	// Lets you tell apart multiple worktrees/branches running simultaneously in the browser.
	function shortBranch(full: string): string {
		const stripped = full.replace(/^[^/]+\//, ''); // strip feature/, fix/, etc.
		return stripped.split(/[-_]/).slice(0, 2).join('-'); // first two segments
	}

	let { children } = $props();

	setShowcaseFormContext();

	// afterNavigate fires after SvelteKit applies <svelte:head><title> from the page,
	// so we can safely prepend without the page overwriting us again.
	// Port is read here (browser-only) so each worktree's port is included.
	afterNavigate(() => {
		if (document.title && !document.title.startsWith('[')) {
			const branch = shortBranch(__GIT_BRANCH__);
			const port = window.location.port;
			const prefix = port ? `[${branch}:${port}]` : `[${branch}]`;
			document.title = `${prefix} ${document.title}`;
		}
	});
</script>

<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
	<link
		rel="preload"
		href={figtreeLatinUrl}
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href={notoSansLatinUrl}
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

{@render children()}
