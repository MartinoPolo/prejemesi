<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	interface WishlistCardGridProps {
		children: Snippet;
		class?: string;
	}

	let { children, class: className }: WishlistCardGridProps = $props();
</script>

<div class={cn('grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3', className)}>
	{@render children()}
</div>
