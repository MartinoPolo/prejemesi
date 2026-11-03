<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { dialogScrollSectionVariants } from './dialog_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-body"
	class={cn(dialogScrollSectionVariants().body(), className)}
	{...restProps}
>
	{@render children?.()}
</div>
