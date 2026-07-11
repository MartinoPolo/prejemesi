<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ROBOTS_NOINDEX_CONTENT } from '$lib/seo/robots.js';

	interface AuthLayoutProps {
		children: Snippet;
	}

	let { children }: AuthLayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content={ROBOTS_NOINDEX_CONTENT} />
</svelte:head>

<div class="auth-screen">
	{@render children()}
</div>

<style>
	.auth-screen {
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		min-height: 100dvh;
		background: var(--background);
	}

	@media (width <= 768px) {
		.auth-screen {
			grid-template-columns: 1fr;
		}
	}
</style>
