<script lang="ts">
	import type { Snippet } from 'svelte';

	interface AuthFormCardProps {
		title: string;
		subtitle: string;
		children: Snippet;
	}

	let { title, subtitle, children }: AuthFormCardProps = $props();
</script>

<div class="form-panel">
	<div class="form-inner">
		<h1 class="form-heading">{title}</h1>
		<p class="form-subheading">{subtitle}</p>
		{@render children()}
	</div>
</div>

<style>
	.form-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-12) var(--space-10);
		background: var(--background);
		overflow-y: auto;
		min-height: 100dvh;
	}

	.form-inner {
		width: 100%;
		max-width: 420px;
	}

	.form-heading {
		font-family: var(--font-heading);
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		color: var(--foreground);
		letter-spacing: var(--tracking-tight);
		margin-bottom: var(--space-1);
		line-height: var(--leading-tight);
	}

	.form-subheading {
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		margin-bottom: var(--space-8);
		line-height: var(--leading-relaxed);
	}

	@media (width <= 768px) {
		.form-panel {
			padding: var(--space-6) var(--space-4);
			min-height: auto;
			justify-content: flex-start;
			padding-top: var(--space-12);
		}
	}
</style>
