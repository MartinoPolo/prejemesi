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

<!-- Phones stack the actions with the primary one on top; wider screens put them on one row.
     Actions keep the default Button size so every dialog footer matches. -->
<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn(
		'gap-(--nested-control-gap) flex flex-col-reverse sm:flex-row sm:justify-end',
		dialogScrollSectionVariants().footer(),
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
