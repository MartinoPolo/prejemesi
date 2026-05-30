<script lang="ts">
	import Navbar from '$lib/components/blocks/navbar/Navbar.svelte';

	import type { Snippet } from 'svelte';

	interface AppLayoutProps {
		children: Snippet;
	}

	let { children }: AppLayoutProps = $props();
</script>

<div class="app-shell">
	<Navbar />
	<main class="app-content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	.app-content {
		flex: 1;
		width: 100%;
		max-width: var(--content-max-width);
		margin-inline: auto;
		padding-inline: var(--space-6);
		padding-block: var(--space-6);
	}
</style>
