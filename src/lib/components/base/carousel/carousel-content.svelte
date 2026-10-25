<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useCarousel } from './context.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const carousel = useCarousel();
</script>

<!-- A native scroller keeps touch, trackpad and Shift+wheel scrolling on the compositor thread, so
     the row stays smooth however busy the page's main thread is. -->
<div
	data-slot="carousel-content"
	class="carousel-viewport overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
	{@attach carousel.attachViewport}
>
	<div
		bind:this={ref}
		data-slot="carousel-container"
		class={cn('flex -ms-4', className)}
		{...restProps}
	>
		{@render children?.()}
	</div>
</div>

<style>
	.carousel-viewport:global([data-dragging]) {
		cursor: grabbing;
		user-select: none;
	}
</style>
