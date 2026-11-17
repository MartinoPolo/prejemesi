<script lang="ts">
	import { pauseWhenOffscreen } from '$lib/motion/pause_offscreen.js';
	import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="skeleton"
	class={cn(
		'bg-muted rounded-btn motion-safe:animate-pulse data-offscreen:[animation-play-state:paused]',
		className,
	)}
	{@attach pauseWhenOffscreen}
	{...restProps}
></div>
