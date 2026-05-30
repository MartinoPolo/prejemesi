<script lang="ts">
	import type { Snippet } from 'svelte';
	import { pageHeaderVariants, type PageHeaderSize } from './page-header-variants.js';
	import { cn } from '$lib/utils.js';

	interface PageHeaderProps {
		title: string;
		size?: PageHeaderSize;
		toolbar?: Snippet;
		class?: string;
	}

	let { title, size = 'md', toolbar, class: className }: PageHeaderProps = $props();

	const variants = $derived(pageHeaderVariants({ size }));
</script>

<div class={cn(variants.root(), className)}>
	<h1 class={variants.title()}>{title}</h1>
	{#if toolbar}
		<div class={variants.toolbar()}>
			{@render toolbar()}
		</div>
	{/if}
</div>
