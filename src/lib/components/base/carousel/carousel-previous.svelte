<script lang="ts">
	import type { WithoutChildren } from 'bits-ui';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
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
	data-slot="carousel-previous"
	{intent}
	{size}
	format="icon"
	aria-disabled={!carousel.canScrollPrev}
	disabled={!carousel.canScrollPrev}
	class={cn('touch-manipulation', className)}
	onclick={carousel.scrollPrev}
	onkeydown={carousel.handleKeyDown}
	{...restProps}
	bind:ref
>
	<ChevronLeftIcon />
	<span class="sr-only">Předchozí</span>
</Button>
