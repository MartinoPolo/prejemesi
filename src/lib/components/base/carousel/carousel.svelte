<script lang="ts">
	import {
		type CarouselAPI,
		type CarouselProps,
		type EmblaContext,
		setEmblaContext,
	} from './context.js';
	import { resolveCarouselScrollability } from './carousel_scrollability.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		opts = {},
		plugins = [],
		setApi = () => {},
		orientation = 'horizontal',
		class: className,
		children,
		...restProps
	}: WithElementRef<CarouselProps> = $props();

	// svelte-ignore state_referenced_locally
	let carouselState = $state<EmblaContext>({
		api: undefined,
		scrollPrev,
		scrollNext,
		orientation,
		canScrollNext: false,
		canScrollPrev: false,
		handleKeyDown,
		options: opts,
		plugins,
		onInit,
		scrollSnaps: [],
		selectedIndex: 0,
		scrollTo,
	});

	setEmblaContext(carouselState);

	function scrollPrev() {
		carouselState.api?.scrollPrev();
	}

	function scrollNext() {
		carouselState.api?.scrollNext();
	}

	function scrollTo(index: number, jump?: boolean) {
		carouselState.api?.scrollTo(index, jump);
	}

	function updateScrollability() {
		if (!carouselState.api) {
			return;
		}
		const { canScrollPrev, canScrollNext } = resolveCarouselScrollability(
			carouselState.api,
			opts,
		);
		carouselState.canScrollPrev = canScrollPrev;
		carouselState.canScrollNext = canScrollNext;
	}

	function onSelect() {
		if (!carouselState.api) {
			return;
		}
		carouselState.selectedIndex = carouselState.api.selectedScrollSnap();
		updateScrollability();
	}

	function onReInit() {
		if (!carouselState.api) {
			return;
		}
		carouselState.scrollSnaps = carouselState.api.scrollSnapList();
		onSelect();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			scrollPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			scrollNext();
		}
	}

	function onInit(event: CustomEvent<CarouselAPI>) {
		carouselState.api = event.detail;
		setApi(carouselState.api);

		carouselState.scrollSnaps = carouselState.api.scrollSnapList();
		carouselState.api.on('select', onSelect);
		carouselState.api.on('scroll', updateScrollability);
		carouselState.api.on('settle', updateScrollability);
		carouselState.api.on('reInit', onReInit);
		onSelect();
	}

	$effect(() => {
		return () => {
			carouselState.api?.off('select', onSelect);
			carouselState.api?.off('scroll', updateScrollability);
			carouselState.api?.off('settle', updateScrollability);
			carouselState.api?.off('reInit', onReInit);
		};
	});
</script>

<div
	bind:this={ref}
	data-slot="carousel"
	class={cn('relative', className)}
	role="region"
	aria-roledescription="carousel"
	{...restProps}
>
	{@render children?.()}
</div>
