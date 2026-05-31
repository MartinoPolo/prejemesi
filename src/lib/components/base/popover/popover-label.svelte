<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable<HTMLDivElement | null>(null),
		class: className,
		children,
		...restProps
	}: {
		ref?: HTMLDivElement | null;
		class?: string;
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	bind:this={ref}
	data-slot="popover-label"
	class={cn(
		'px-2 pb-1 pt-1.5 text-(length:--text-2xs) font-medium uppercase tracking-wider text-foreground-subtle',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
