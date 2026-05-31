<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { emptyStateVariants } from './empty_state_variants.js';
	import type { Snippet } from 'svelte';

	interface EmptyStateProps {
		emoji: string;
		title: string;
		description: string;
		/** CTA button or other actions */
		actions?: Snippet;
		class?: string;
	}

	let { emoji, title, description, actions, class: className }: EmptyStateProps = $props();

	const variants = emptyStateVariants();
</script>

<div class={cn(variants.root(), className)}>
	<div class={variants.glyph()}>{emoji}</div>
	<h2 class={variants.title()}>{title}</h2>
	<p class={variants.description()}>{description}</p>
	{#if actions}
		{@render actions()}
	{/if}
</div>
