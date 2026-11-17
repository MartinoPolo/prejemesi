<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { dialogScrollSectionVariants } from './dialog_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		lead,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/** Start-aligned content apart from the actions, such as a destructive action or a hint. */
		lead?: Snippet;
	} = $props();
</script>

<!-- Phones stack the actions with the primary one on top and the lead last; wider screens put them
     on one row with the lead at the start. -->
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
	{#if lead}
		<div
			data-slot="dialog-footer-lead"
			class="gap-(--nested-control-gap) flex flex-col sm:me-auto sm:flex-row sm:items-center"
		>
			{@render lead()}
		</div>
	{/if}
	{@render children?.()}
</div>
