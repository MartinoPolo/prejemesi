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
		'col-end-[-1] row-span-2 row-start-1 -mt-(--depth-clearance) self-center justify-self-end',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
