<script lang="ts">
	import type { Snippet } from 'svelte';

	interface AuthLayoutProps {
		children: Snippet;
	}

	let { children }: AuthLayoutProps = $props();
</script>

<div class="auth-screen">
	{@render children()}
</div>

<style>
	.auth-screen {
		display: grid;
		grid-template-columns: 45fr 55fr;
		min-height: 100dvh;
		background: var(--background);
	}

	@media (max-width: 768px) {
		.auth-screen {
			grid-template-columns: 1fr;
		}
	}
</style>
