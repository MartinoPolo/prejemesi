<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-action"
	class={cn(
		'absolute top-[calc(50%_-_var(--elevation-ordinary-offset)/2)] right-3 -translate-y-1/2',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
