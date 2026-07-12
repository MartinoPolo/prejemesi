<script lang="ts">
	import type { Snippet } from 'svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

	interface AuthSuccessBannerProps {
		children: Snippet;
	}

	let { children }: AuthSuccessBannerProps = $props();
</script>

<div class="success-banner" role="status">
	<CircleCheckIcon class="success-icon" />
	<div>
		{@render children()}
	</div>
</div>

<style>
	.success-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		background: color-mix(in oklab, var(--status-success) 10%, var(--card));
		border: 2.5px solid var(--ink);
		border-radius: 12px;
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-5);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--status-success);
		line-height: var(--leading-snug);
	}

	.success-banner :global(.success-icon) {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-top: 1px;
	}
</style>
