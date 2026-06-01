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
		background: oklch(from var(--status-success) l c h / 8%);
		border: 1px solid oklch(from var(--status-success) l c h / 28%);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-5);
		font-size: var(--text-sm);
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
