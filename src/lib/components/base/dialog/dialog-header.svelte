<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { dialogScrollSectionVariants } from './dialog_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		divided = false,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/** Draws a thin bottom border, for a header that carries a stepper or tabs. */
		divided?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-header"
	data-header-divided={divided || undefined}
	class={cn(
		'gap-2 flex flex-col text-center sm:text-left',
		dialogScrollSectionVariants({ divided }).header(),
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
