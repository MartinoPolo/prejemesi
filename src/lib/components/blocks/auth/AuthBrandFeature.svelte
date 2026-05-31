<script lang="ts">
	import type { Component } from 'svelte';

	interface AuthBrandFeatureProps {
		icon: Component;
		title: string;
		description: string;
	}

	let { icon: Icon, title, description }: AuthBrandFeatureProps = $props();
</script>

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
		align-items: center;
		gap: var(--space-3);
		text-align: left;
	}

	.brand-feature-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: oklch(from white l c h / 14%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		flex-shrink: 0;
	}

	.brand-feature-text {
		font-size: var(--text-sm);
		color: white;
		line-height: var(--leading-snug);
	}

	.brand-feature-text strong {
		display: block;
		font-weight: var(--weight-semibold);
	}

	.brand-feature-text span {
		opacity: 0.75;
		font-size: var(--text-xs);
	}
</style>
