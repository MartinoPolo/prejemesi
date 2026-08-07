<script lang="ts">
	import type { WithoutChildren } from 'bits-ui';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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

	const emblaCtx = getEmblaContext('<Carousel.Next/>');
</script>

<Button
	data-slot="carousel-next"
	{intent}
	{size}
	aria-disabled={!emblaCtx.canScrollNext}
	disabled={!emblaCtx.canScrollNext}
	class={cn('touch-manipulation', className)}
	onclick={emblaCtx.scrollNext}
	onkeydown={emblaCtx.handleKeyDown}
	bind:ref
	{...restProps}
>
	<ChevronRightIcon />
	<span class="sr-only">Další</span>
</Button>
