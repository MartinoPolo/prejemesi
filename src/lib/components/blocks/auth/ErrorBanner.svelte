<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	interface ErrorBannerProps {
		message: string;
	}

	let { message }: ErrorBannerProps = $props();
</script>

{#if message}
	<div class="error-banner" role="alert">
		<CircleAlert class="error-banner-icon" />
		<span>{message}</span>
	</div>
{/if}

<style>
	.error-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		background: oklch(from var(--destructive) l c h / 0.08);
		border: 1px solid oklch(from var(--destructive) l c h / 0.28);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-5);
		font-size: var(--text-sm);
		color: var(--destructive);
		line-height: var(--leading-snug);
	}

	.error-banner :global(.error-banner-icon) {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-top: 1px;
	}
</style>
