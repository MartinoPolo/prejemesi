<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="dropdown-menu-shortcut"
	class={cn(
		'text-muted-foreground group-data-[variant=destructive]/dropdown-menu-item:text-destructive ml-auto text-xs tracking-widest',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</span>
