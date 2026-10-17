<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import {
		inputGroupSegmentVariants,
		type InputGroupSegmentState,
	} from './input_group_segment_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		decorative = false,
		state = 'default',
		type = 'button',
		children,
		...restProps
	}: WithElementRef<HTMLButtonAttributes, HTMLElement> & {
		/** Presentational look-alike: a hidden, non-focusable span instead of a button. */
		decorative?: boolean;
		state?: InputGroupSegmentState;
	} = $props();

	const segmentClass = $derived(
		cn(inputGroupSegmentVariants({ interactive: !decorative, state }), className),
	);
</script>

{#if decorative}
	<span bind:this={ref} data-slot="input-group-segment" aria-hidden="true" class={segmentClass}>
		{@render children?.()}
	</span>
{:else}
	<button
		bind:this={ref}
		data-slot="input-group-segment"
		{type}
		{...restProps}
		class={segmentClass}
	>
		{@render children?.()}
	</button>
{/if}
