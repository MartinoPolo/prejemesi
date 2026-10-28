<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Attachment } from 'svelte/attachments';
	import { prefersReducedMotion } from 'svelte/motion';
	import { setCarouselContext } from './context.js';
	import { attachMouseDragScroll } from './mouse_drag_scroll.js';
	import { resolveCardTarget, resolveScrollability } from './scroll_row.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type CarouselProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		canScrollPrev?: boolean;
		canScrollNext?: boolean;
	};

	let {
		ref = $bindable(null),
		canScrollPrev = $bindable(false),
		canScrollNext = $bindable(false),
		class: className,
		children,
		...restProps
	}: CarouselProps = $props();

	let viewport: HTMLElement | null = null;
	// Target of an arrow-button glide still in flight, so repeated presses advance slide by slide
	// instead of re-aiming at the slide the glide is already heading to.
	let pendingTarget: number | null = null;

	function updateScrollability() {
		if (viewport === null) {
			return;
		}
		const scrollability = resolveScrollability(
			viewport.scrollLeft,
			viewport.scrollWidth,
			viewport.clientWidth,
		);
		canScrollPrev = scrollability.canScrollPrev;
		canScrollNext = scrollability.canScrollNext;
	}

	function scrollByDirection(direction: 1 | -1) {
		if (viewport === null) {
			return;
		}
		const viewportLeft = viewport.getBoundingClientRect().left - viewport.scrollLeft;
		// Cards start after each slide's leading gutter; aligning slide starts instead would let
		// Previous move only that gutter when the leading card already sits inside it.
		const cardStarts = Array.from(
			viewport.querySelectorAll<HTMLElement>('[data-slot="carousel-item"]'),
			(slide) =>
				slide.getBoundingClientRect().left +
				parseFloat(getComputedStyle(slide).paddingLeft) -
				viewportLeft,
		);
		const target = resolveCardTarget(
			cardStarts,
			pendingTarget ?? viewport.scrollLeft,
			viewport.scrollWidth - viewport.clientWidth,
			direction,
		);
		pendingTarget = target;
		viewport.scrollTo({
			left: target,
			behavior: prefersReducedMotion.current ? 'instant' : 'smooth',
		});
	}

	function clearPendingTarget() {
		pendingTarget = null;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			scrollByDirection(-1);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			scrollByDirection(1);
		}
	}

	const attachViewport: Attachment<HTMLElement> = (element) => {
		viewport = element;
		const resizeObserver = new ResizeObserver(updateScrollability);
		resizeObserver.observe(element);
		for (const child of element.children) {
			resizeObserver.observe(child);
		}
		const detachMouseDrag = attachMouseDragScroll(element);
		const userScrollEvents = ['scrollend', 'wheel', 'touchstart', 'pointerdown'] as const;
		element.addEventListener('scroll', updateScrollability, { passive: true });
		for (const type of userScrollEvents) {
			element.addEventListener(type, clearPendingTarget, { passive: true });
		}
		updateScrollability();
		return () => {
			resizeObserver.disconnect();
			detachMouseDrag();
			element.removeEventListener('scroll', updateScrollability);
			for (const type of userScrollEvents) {
				element.removeEventListener(type, clearPendingTarget);
			}
			viewport = null;
		};
	};

	setCarouselContext({
		get canScrollPrev() {
			return canScrollPrev;
		},
		get canScrollNext() {
			return canScrollNext;
		},
		scrollPrev: () => scrollByDirection(-1),
		scrollNext: () => scrollByDirection(1),
		handleKeyDown,
		attachViewport,
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
