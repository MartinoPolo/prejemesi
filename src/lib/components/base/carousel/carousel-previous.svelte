<script lang="ts">
	import type { WithoutChildren } from 'bits-ui';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { getEmblaContext } from './context.js';
	import { cn } from '$lib/utils.js';
	import { Button, type Props } from '$lib/components/base/button/index.js';

	let {
		ref = $bindable(null),
		class: className,
		intent = 'secondary',
		size = 'icon',
		...restProps
	}: WithoutChildren<Props> = $props();

	const emblaCtx = getEmblaContext('<Carousel.Previous/>');
</script>

<Button
	data-slot="carousel-previous"
	{intent}
	{size}
	aria-disabled={!emblaCtx.canScrollPrev}
	disabled={!emblaCtx.canScrollPrev}
	class={cn('touch-manipulation', className)}
	onclick={emblaCtx.scrollPrev}
	onkeydown={emblaCtx.handleKeyDown}
	{...restProps}
	bind:ref
>
	<ChevronLeftIcon />
	<span class="sr-only">Předchozí</span>
</Button>
