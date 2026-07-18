<script lang="ts">
	import type { Component } from 'svelte';

	interface AuthBrandFeatureProps {
		icon: Component;
		title: string;
		description: string;
	}

	let { icon: Icon, title, description }: AuthBrandFeatureProps = $props();
</script>

<!-- Anime-sky tick row (`anime-auth.html` brand values): tilted brand square + ink text. -->
<div class="brand-feature-item">
	<div class="brand-feature-icon" aria-hidden="true">
		<Icon class="size-4" />
	</div>
	<div class="brand-feature-text">
		<strong>{title}</strong>
		<span>{description}</span>
	</div>
</div>

<style>
	.brand-feature-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		text-align: left;
	}

	.brand-feature-icon {
		width: 30px;
		height: 30px;
		margin-top: 2px;
		border-radius: 8px;
		background: var(--primary);
		border: 2px solid var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--primary-foreground);
		flex-shrink: 0;
		transform: rotate(-3deg);
	}

	.brand-feature-text {
		font-size: var(--text-sm);
		color: var(--ink);
		line-height: var(--leading-snug);
	}

	.brand-feature-text strong {
		display: block;
		font-weight: var(--weight-semibold);
	}

	.brand-feature-text span {
		color: var(--muted-foreground);
		font-size: var(--text-xs);
	}
</style>
