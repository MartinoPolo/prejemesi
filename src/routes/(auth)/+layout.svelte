<script lang="ts">
	import type { Snippet } from 'svelte';

	interface AuthLayoutProps {
		children: Snippet;
	}

	let { children }: AuthLayoutProps = $props();
</script>

<main class="auth-layout">
	{@render children()}
</main>

<style>
	.auth-layout {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: var(--space-6);
	}
</style>
