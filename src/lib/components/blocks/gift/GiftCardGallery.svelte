<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { prefersReducedMotion } from 'svelte/motion';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { cn } from '$lib/utils.js';
	import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
	import type { GiftImage as GiftGalleryImage } from '$lib/modules/gifts/gift_images.js';
	import {
		classifyGallerySwipe,
		galleryNeighbourIndexes,
		gallerySwipeStep,
		wrapGalleryIndex,
		type GallerySwipeIntent,
	} from '$lib/modules/gifts/gift_gallery.js';
	import GiftImage from './GiftImage.svelte';
	import GiftGalleryIndicator from './GiftGalleryIndicator.svelte';
	import { GIFT_CARD_CONTROL_SELECTOR } from './gift_card_controls.js';

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

	const count = $derived(images.length);
	// Only the cover loads up front; other images mount once the card is browsed or about to be.
	const mountedIndexes = new SvelteSet<number>([0]);
	// `bind:this` resets an entry to null when its slide unmounts.
	const slideElements: (HTMLElement | null | undefined)[] = [];

	let outgoingIndex = $state<number | null>(null);
	let dragOffset = $state(0);
	let dragNeighbourIndex = $state<number | null>(null);
	let runningAnimations: Animation[] = [];
	let animationRun = 0;
	let swipe: {
		pointerId: number;
		startX: number;
		startY: number;
		width: number;
		intent: GallerySwipeIntent;
	} | null = null;

	const dragNeighbourSide = $derived(dragOffset < 0 ? 1 : -1);

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

	function slideTransform(imageIndex: number): string | undefined {
		if (imageIndex === index && dragOffset !== 0) {
			return `translateX(${dragOffset}px)`;
		}
		if (imageIndex === dragNeighbourIndex) {
			return `translateX(calc(${dragNeighbourSide * 100}% + ${dragOffset}px))`;
		}
		return undefined;
	}

	function isSlideVisible(imageIndex: number): boolean {
		return (
			imageIndex === index ||
			imageIndex === outgoingIndex ||
			imageIndex === dragNeighbourIndex
		);
	}

	function stopAnimations() {
		animationRun += 1;
		for (const animation of runningAnimations) {
			animation.cancel();
		}
		runningAnimations = [];
		outgoingIndex = null;
	}

	/** Slides with the shared motion tokens, then settles state before dropping the held frames. */
	async function animateSlides(
		moves: readonly (readonly [number, Keyframe[]])[],
		settle: () => void,
	) {
		const run = animationRun;
		const reference = slideElements[index];
		const style = reference == null ? null : getComputedStyle(reference);
		const easing = style?.getPropertyValue('--ease-standard').trim() ?? '';
		const timing: KeyframeAnimationOptions = {
			duration: Number.parseFloat(style?.getPropertyValue('--duration-slow') ?? '') || 300,
			easing: easing === '' ? 'ease-out' : easing,
			fill: 'forwards',
		};
		const animations = moves.flatMap(([slideIndex, keyframes]) => {
			const element = slideElements[slideIndex];
			return element == null ? [] : [element.animate(keyframes, timing)];
		});
		runningAnimations = animations;
		try {
			await Promise.all(animations.map((animation) => animation.finished));
		} catch {
			return;
		}
		if (run !== animationRun) {
			return;
		}
		settle();
		await tick();
		for (const animation of animations) {
			animation.cancel();
		}
		runningAnimations = [];
	}

	async function navigate(step: -1 | 1, fromOffset = 0) {
		stopAnimations();
		const previousIndex = index;
		const nextIndex = wrapGalleryIndex(previousIndex + step, count);
		dragOffset = 0;
		dragNeighbourIndex = null;
		mountWithNeighbours(nextIndex);
		onindexchange(nextIndex);
		if (prefersReducedMotion.current || nextIndex === previousIndex) {
			return;
		}
		outgoingIndex = previousIndex;
		await tick();
		await animateSlides(
			[
				[
					nextIndex,
					[
						{ transform: `translateX(calc(${step * 100}% + ${fromOffset}px))` },
						{ transform: 'translateX(0)' },
					],
				],
				[
					previousIndex,
					[
						{ transform: `translateX(${fromOffset}px)` },
						{ transform: `translateX(${-step * 100}%)` },
					],
				],
			],
			() => {
				outgoingIndex = null;
			},
		);
	}

	async function snapBack() {
		const neighbourIndex = dragNeighbourIndex;
		const side = dragNeighbourSide;
		if (dragOffset === 0 || neighbourIndex === null) {
			dragOffset = 0;
			dragNeighbourIndex = null;
			return;
		}
		await animateSlides(
			[
				[
					index,
					[{ transform: `translateX(${dragOffset}px)` }, { transform: 'translateX(0)' }],
				],
				[
					neighbourIndex,
					[
						{ transform: `translateX(calc(${side * 100}% + ${dragOffset}px))` },
						{ transform: `translateX(${side * 100}%)` },
					],
				],
			],
			() => {
				dragOffset = 0;
				dragNeighbourIndex = null;
			},
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
				stopAnimations();
				onswipingchange(true);
			}
		}
		if (swipe.intent === 'horizontal' && !prefersReducedMotion.current) {
			dragOffset = deltaX;
			dragNeighbourIndex = wrapGalleryIndex(index + (deltaX < 0 ? 1 : -1), count);
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
		const deltaX = event.clientX - finishedSwipe.startX;
		const step = event.type === 'pointerup' ? gallerySwipeStep(deltaX, finishedSwipe.width) : 0;
		if (step === 0) {
			void snapBack();
		} else {
			void navigate(step, dragOffset);
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (swiping is a touch shortcut; the arrows,
     indicator and Gift viewer keep browsing accessible) -->
<div
	class={cn(
		'absolute inset-x-0 top-0 bottom-(--border-w) flex items-center justify-center',
		interactive && 'touch-pan-y',
	)}
	data-testid="gift-card-gallery"
	onpointerdown={startSwipe}
	onpointermove={moveSwipe}
	onpointerup={endSwipe}
	onpointercancel={endSwipe}
>
	<div class={cn(compositionClass, 'relative')} data-testid="gift-card-crop-composition">
		{#each images as image, imageIndex (imageIndex)}
			{#if mountedIndexes.has(imageIndex)}
				<div
					bind:this={slideElements[imageIndex]}
					class={cn('absolute inset-0', !isSlideVisible(imageIndex) && 'invisible')}
					style:transform={slideTransform(imageIndex)}
					data-gallery-slide={imageIndex}
					data-current={imageIndex === index || undefined}
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

{#if interactive}
	<span class="gift-card-gallery-arrow left-2">
		<Button
			intent="secondary"
			size="md"
			format="icon"
			aria-label={m.gift_gallery_previous_image()}
			data-testid="gift-card-gallery-previous"
			onclick={() => navigate(-1)}
		>
			<ChevronLeftIcon />
		</Button>
	</span>
	<span class="gift-card-gallery-arrow right-[calc(0.5rem+var(--depth-clearance))]">
		<Button
			intent="secondary"
			size="md"
			format="icon"
			aria-label={m.gift_gallery_next_image()}
			data-testid="gift-card-gallery-next"
			onclick={() => navigate(1)}
		>
			<ChevronRightIcon />
		</Button>
	</span>
{/if}

<!-- Centered on the priority row; narrow cards move it to the end so it clears the priority badge. -->
<GiftGalleryIndicator
	{count}
	{index}
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
