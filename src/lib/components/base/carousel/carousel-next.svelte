<script lang="ts">
	import type { WithoutChildren } from 'bits-ui';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { useCarousel } from './context.js';
	import { cn } from '$lib/utils.js';
	import { Button, type Props } from '$lib/components/base/button/index.js';

	let {
		ref = $bindable(null),
		class: className,
		intent = 'secondary',
		size = 'md',
		...restProps
	}: WithoutChildren<Props> = $props();

	const carousel = useCarousel();
</script>

<Button
	data-slot="carousel-next"
	{intent}
	{size}
	format="icon"
	aria-disabled={!carousel.canScrollNext}
	disabled={!carousel.canScrollNext}
	class={cn('touch-manipulation', className)}
	onclick={carousel.scrollNext}
	onkeydown={carousel.handleKeyDown}
	bind:ref
	{...restProps}
>
	<ChevronRightIcon />
	<span class="sr-only">Další</span>
</Button>
