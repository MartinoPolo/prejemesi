<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cn } from '$lib/utils.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import type { GiftImage as GiftGalleryImage } from '$lib/modules/gifts/gift_images.js';
	import {
		clampGalleryIndex,
		classifyGallerySwipe,
		galleryDragOffset,
		galleryNeighbourIndexes,
		gallerySwipeStep,
		type GallerySwipeIntent,
	} from '$lib/modules/gifts/gift_gallery.js';
	import GiftImage from './GiftImage.svelte';
	import GiftGalleryArrow from './GiftGalleryArrow.svelte';
	import GiftGalleryIndicator from './GiftGalleryIndicator.svelte';
	import { GIFT_CARD_CONTROL_SELECTOR } from './gift_card_controls.js';
	import { GIFT_CARD_LAYOUT_INERT_ATTRIBUTE } from './gift_card_layout_inert.js';
	import { browseKeepingArrowFocus, type GalleryStep } from './gift_gallery_arrows.js';

	interface Props {
		images: readonly GiftGalleryImage[];
		alt: string;
		/** The image the card shows. */
		index: number;
		/** Off in reorder and selection modes, where the card shows its cover. */
		interactive: boolean;
		/** Classes of the card's crop composition box, including its dimmed fade. */
		compositionClass: string;
		/** The card was hovered or focused, so the next and previous images preload. */
		warm: boolean;
		onindexchange: (index: number) => void;
		/** A horizontal swipe owns the press, so the card must not show its own press state. */
		onswipingchange: (swiping: boolean) => void;
	}

	let {
		images,
		alt,
		index,
		interactive,
		compositionClass,
		warm,
		onindexchange,
		onswipingchange,
	}: Props = $props();

	/** A click the browser may still dispatch for a finished swipe arrives within this window. */
	const SWIPE_CLICK_WINDOW_MS = 500;

	// Browsing images never changes the card's size, so the collection layout skips re-measuring.
	const layoutInert = { [GIFT_CARD_LAYOUT_INERT_ATTRIBUTE]: '' };

	const count = $derived(images.length);
	// Only the cover loads up front; other images mount once the card is browsed or about to be,
	// so a neighbour already waits off-screen when the track slides to it.
	const mountedIndexes = new SvelteSet<number>([0]);

	let dragOffset = $state(0);
	let dragging = $state(false);
	let previousArrow = $state<HTMLElement | null>(null);
	let nextArrow = $state<HTMLElement | null>(null);
	let swipe: {
		pointerId: number;
		startX: number;
		startY: number;
		width: number;
		intent: GallerySwipeIntent;
	} | null = null;

	function mountWithNeighbours(imageIndex: number) {
		for (const mountedIndex of [imageIndex, ...galleryNeighbourIndexes(imageIndex, count)]) {
			mountedIndexes.add(mountedIndex);
		}
	}

	$effect(() => {
		if (warm && interactive) {
			const shownIndex = index;
			untrack(() => mountWithNeighbours(shownIndex));
		}
	});

	/** Each slide sits at its distance from the shown image; the finger's drag shifts them all. */
	function slideTransform(imageIndex: number): string {
		return `translateX(calc(${String((imageIndex - index) * 100)}% + ${String(dragOffset)}px))`;
	}

	/** Hidden slides leave the accessibility tree; a dragged neighbour shows while it is pulled in. */
	function isSlideVisible(imageIndex: number): boolean {
		return imageIndex === index || (dragOffset !== 0 && Math.abs(imageIndex - index) === 1);
	}

	function navigate(step: GalleryStep) {
		const nextIndex = clampGalleryIndex(index + step, count);
		dragOffset = 0;
		if (nextIndex !== index) {
			mountWithNeighbours(nextIndex);
			onindexchange(nextIndex);
		}
	}

	function browseWithArrow(step: GalleryStep) {
		browseKeepingArrowFocus(
			step,
			() => ({ previous: previousArrow, next: nextArrow }),
			() => navigate(step),
		);
	}

	function swallowClickAfterSwipe() {
		const swallow = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
		};
		window.addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(
			() => window.removeEventListener('click', swallow, { capture: true }),
			SWIPE_CLICK_WINDOW_MS,
		);
	}

	function startSwipe(event: PointerEvent & { currentTarget: HTMLElement }) {
		if (
			!interactive ||
			event.pointerType !== 'touch' ||
			!event.isPrimary ||
			(event.target instanceof Element && event.target.closest(GIFT_CARD_CONTROL_SELECTOR))
		) {
			return;
		}
		mountWithNeighbours(index);
		swipe = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			width: event.currentTarget.clientWidth,
			intent: 'pending',
		};
	}

	function moveSwipe(event: PointerEvent) {
		if (swipe === null || event.pointerId !== swipe.pointerId) {
			return;
		}
		const deltaX = event.clientX - swipe.startX;
		if (swipe.intent === 'pending') {
			swipe.intent = classifyGallerySwipe(deltaX, event.clientY - swipe.startY);
			if (swipe.intent === 'vertical') {
				swipe = null;
				return;
			}
			if (swipe.intent === 'horizontal') {
				onswipingchange(true);
			}
		}
		if (swipe.intent === 'horizontal' && !prefersReducedMotion.current) {
			dragging = true;
			dragOffset = galleryDragOffset(deltaX, swipe.width, index, count);
		}
	}

	function endSwipe(event: PointerEvent) {
		if (swipe === null || event.pointerId !== swipe.pointerId) {
			return;
		}
		const finishedSwipe = swipe;
		swipe = null;
		if (finishedSwipe.intent !== 'horizontal') {
			return;
		}
		onswipingchange(false);
		swallowClickAfterSwipe();
		// The slides transition from where the finger left them: on to the next image, or back.
		dragging = false;
		const deltaX = event.clientX - finishedSwipe.startX;
		const step = event.type === 'pointerup' ? gallerySwipeStep(deltaX, finishedSwipe.width) : 0;
		if (step === 0) {
			dragOffset = 0;
		} else {
			navigate(step);
		}
	}
</script>

<!-- A static element may own the swipe handlers: swiping is a touch shortcut, and the arrows,
     indicator and Gift viewer keep browsing accessible. -->
<div
	class={cn(
		'absolute inset-x-0 top-0 bottom-(--border-w) flex items-center justify-center',
		interactive && 'touch-pan-y',
	)}
	data-testid="gift-card-gallery"
	{...layoutInert}
	onpointerdown={startSwipe}
	onpointermove={moveSwipe}
	onpointerup={endSwipe}
	onpointercancel={endSwipe}
>
	<div
		class={cn(compositionClass, 'relative overflow-hidden')}
		data-testid="gift-card-crop-composition"
	>
		{#each images as image, imageIndex (imageIndex)}
			{#if mountedIndexes.has(imageIndex)}
				<!-- Visibility transitions with the slide, so an outgoing image stays painted until
				     it has left the frame. -->
				<div
					class={cn(
						'absolute inset-0',
						!dragging &&
							'motion-safe:transition-[transform,visibility] motion-safe:duration-(--duration-slow) motion-safe:ease-(--ease-standard)',
						!isSlideVisible(imageIndex) && 'invisible',
					)}
					style:transform={slideTransform(imageIndex)}
					data-gallery-slide={imageIndex}
					data-current={imageIndex === index || undefined}
					aria-hidden={imageIndex !== index || undefined}
				>
					<GiftImage
						class="size-full rounded-none bg-transparent max-sm:[&_img]:p-0"
						imageUrl={resolveGiftImageUrl(image.imageUrl, image.imageKey)}
						imageMeta={image.imageMeta}
						target="square"
						{alt}
						variant="card"
					/>
				</div>
			{/if}
		{/each}
	</div>
</div>

<!-- Only arrows that lead somewhere render, so they show where in the gallery the card is. Their
     wrappers stay mounted so an arrow appearing or leaving mutates only a layout-inert subtree. -->
<span class="gift-card-gallery-arrow left-2" {...layoutInert}>
	{#if interactive && index > 0}
		<GiftGalleryArrow
			bind:ref={previousArrow}
			direction="previous"
			size="md"
			testId="gift-card-gallery-previous"
			onclick={() => browseWithArrow(-1)}
		/>
	{/if}
</span>
<span class="gift-card-gallery-arrow right-[calc(0.5rem+var(--depth-clearance))]" {...layoutInert}>
	{#if interactive && index < count - 1}
		<GiftGalleryArrow
			bind:ref={nextArrow}
			direction="next"
			size="md"
			testId="gift-card-gallery-next"
			onclick={() => browseWithArrow(1)}
		/>
	{/if}
</span>

<!-- Centered on the priority row; narrow cards move it to the end so it clears the priority badge. -->
<GiftGalleryIndicator
	{count}
	{index}
	{...layoutInert}
	class="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 @max-[16rem]:right-3 @max-[16rem]:left-auto @max-[16rem]:translate-x-0"
/>

<style>
	/* Touch browses by swiping, so arrows exist only for hover-capable pointers. */
	.gift-card-gallery-arrow {
		display: none;
		position: absolute;
		z-index: 20;
		top: calc(50% - var(--border-w) / 2);
		translate: 0 -50%;
	}

	@media (hover: hover) and (pointer: fine) {
		.gift-card-gallery-arrow {
			display: block;
			opacity: 0;
			transition: opacity var(--duration-fast) var(--ease-standard);
		}

		:global(.gift-card-root:is(:hover, :focus-within)) .gift-card-gallery-arrow {
			opacity: 1;
		}
	}
</style>
