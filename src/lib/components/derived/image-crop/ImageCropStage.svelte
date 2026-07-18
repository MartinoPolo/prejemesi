<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import {
		FULL_CROP_RECT,
		IMAGE_ZOOM_MAX,
		IMAGE_ZOOM_OUT_MIN,
		centeredCropRect,
		containZoomForAspect,
		cropRectToFocalZoom,
		fitCropRectToAspect,
		normalizedCropAspect,
		panCropRect,
		zoomCropRect,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';
	import {
		resolveFrameFill,
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';

	interface Props {
		/** Source image being cropped. */
		src: string;
		/** Accessible description of the image. */
		alt: string;
		/**
		 * Pixel aspect ratio (width / height) of the target surface (#116 REQ-2).
		 * The bright window is locked to this shape, so what it frames is exactly
		 * what the target renders (WYSIWYG).
		 */
		targetAspect: number;
		/** Human label of the target surface, shown on the window chip. */
		targetLabel: string;
		/** Real rendered size hint (e.g. „356 × 128 px"), shown on the window chip. */
		realSizeText?: string;
		/** Normalized crop rectangle (0..1), bound to the parent. */
		cropRect: ImageCropRect;
		/** Notified on USER edits only (drag, zoom, keyboard, reset) – never on programmatic aspect snaps. */
		onchange?: (rect: ImageCropRect) => void;
		/** Letterbox fill shown where a zoomed-out window overhangs the image (tier 1). */
		fillColor?: string | null;
		/** Scopes the tier-2 letterbox fill token, mirroring ImageFrame (WYSIWYG). */
		tokenScope?: ImageTokenScope;
		/**
		 * Non-interactive static preview mode (#183 REQ-6/7): hides the thirds
		 * grid, zoom slider, reset button and hint text, and ignores
		 * pointer/keyboard/wheel edits. Defaults to the interactive Manual-editing
		 * behavior.
		 */
		interactive?: boolean;
		/**
		 * Renders the ENTIRE image letterboxed (contain) inside the window instead
		 * of the cover-cropped `cropRect` (REQ-7's Fit preview). Only meaningful
		 * when `interactive` is false.
		 */
		containMode?: boolean;
		/**
		 * Fires on a wheel gesture when `interactive` is false, mirroring
		 * `promoteOnWheel` for the plain preview (REQ-6/7: a zoom attempt still
		 * promotes to Manual). Ignored when `interactive` is true.
		 */
		onWheelPromote?: () => void;
		/**
		 * Shows the target-label/pixel-size chip on the window. The gift editor
		 * removes it entirely (REQ-8); the wishlist editor keeps it.
		 */
		showLabelChip?: boolean;
		class?: string;
	}

	let {
		src,
		alt,
		targetAspect,
		targetLabel,
		realSizeText,
		cropRect = $bindable(),
		onchange,
		fillColor = null,
		tokenScope = IMAGE_TOKEN_SCOPES.global,
		interactive = true,
		containMode = false,
		onWheelPromote,
		showLabelChip = true,
		class: className,
	}: Props = $props();

	/** Padding between the viewport edge and the crop window. */
	const WINDOW_PAD = 16;
	const SLIDER_STEP = 5;
	const WHEEL_ZOOM_STEP = 0.1;
	const KEYBOARD_PAN_FRACTION = 0.05;
	const RECT_EPSILON = 1e-3;
	const GRID_CELLS = Array.from({ length: 9 }, (_unused, index) => index);

	let viewportEl = $state<HTMLDivElement | null>(null);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let naturalRatio = $state<number | null>(null);
	let loadFailed = $state(false);
	let dragging = $state(false);

	// drag bookkeeping (plain, non-reactive – only read inside pointer handlers)
	let startRect: ImageCropRect = { x: 0, y: 0, w: 1, h: 1 };
	let startPointer = { x: 0, y: 0 };

	// Without a measured natural ratio the crop coords can't map to image space, and a
	// broken source must not present a draggable stage over a broken-image glyph.
	const isReady = $derived(!loadFailed && naturalRatio !== null);

	/** Normalized (0..1 space) aspect the crop rect is locked to. */
	const normAspect = $derived(normalizedCropAspect(targetAspect, naturalRatio ?? 1));

	// Zoom-out floor: the whole image fits the window exactly at the contain zoom,
	// so the slider stops there (#116 round 2 – never white space on both axes).
	// The slider minimum stays on the 5 %-step grid anchored at 100 % and never
	// dips below the contain zoom.
	// Before the image loads, `normAspect` falls back to a square placeholder
	// (see above) – the REAL aspect (and thus the real contain-zoom floor) is
	// unknown yet. Using that placeholder's floor here was a display bug: a
	// seeded manual crop persisted below the placeholder's (too-high) floor —
	// e.g. any non-square-normalized target/source pair – got silently clamped
	// by the native `<input type="range">`'s own min/value invariant the instant
	// this floor briefly overshot the seeded value, and the slider never
	// re-synced back down once the real (lower) floor arrived a tick later,
	// because Svelte's `value` prop never itself changed. Falling back to the
	// absolute zoom-out floor (never above any legal persisted zoom) while
	// `!isReady` means the slider can only clamp UP once the true floor is
	// known, at which point `value` already reflects the correct zoom.
	const containZoom = $derived(isReady ? containZoomForAspect(normAspect) : IMAGE_ZOOM_OUT_MIN);
	const sliderMinPercent = $derived(
		100 - SLIDER_STEP * Math.floor((100 - Math.ceil(containZoom * 100)) / SLIDER_STEP),
	);

	/** Letterbox fill behind the window, identical to the renderer's frame fill. */
	const windowFill = $derived(resolveFrameFill({ fillColor, tokenScope }));

	// The bright window: largest target-aspect box that fits the viewport (centered).
	const cropWindow = $derived.by(() => {
		const maxW = viewportWidth - 2 * WINDOW_PAD;
		const maxH = viewportHeight - 2 * WINDOW_PAD;
		if (maxW <= 0 || maxH <= 0) {
			return null;
		}
		const width = Math.min(maxW, maxH * targetAspect);
		const height = width / targetAspect;
		return {
			width,
			height,
			left: (viewportWidth - width) / 2,
			top: (viewportHeight - height) / 2,
		};
	});

	// containMode (REQ-7, non-interactive only) shows the ENTIRE image regardless
	// of `cropRect`: the rect at the aspect's contain zoom, centered – exactly the
	// "whole image, letterboxed on one axis" framing, ignoring any drawn/persisted
	// crop (Fit always discards framing).
	const displayRect = $derived(
		containMode && isReady
			? zoomCropRect(centeredCropRect(normAspect), normAspect, containZoom)
			: cropRect,
	);

	// The source image drawn so that `displayRect` fills the window exactly; the
	// rest overflows dimmed. Position derives from the rect, so pan/zoom just move it.
	const image = $derived.by(() => {
		if (cropWindow === null || naturalRatio === null || displayRect.w <= 0) {
			return null;
		}
		const width = cropWindow.width / displayRect.w;
		const height = width / naturalRatio;
		return {
			width,
			height,
			left: cropWindow.left - displayRect.x * width,
			top: cropWindow.top - displayRect.y * height,
		};
	});

	const zoom = $derived(cropRectToFocalZoom(cropRect).zoom);
	const isDefaultRect = $derived.by(() => {
		const defaultRect = centeredCropRect(normAspect);
		return rectsClose(cropRect, defaultRect);
	});

	// Veil everything outside the window: a clip-path polygon with a rectangular hole.
	const veilClipPath = $derived.by(() => {
		if (cropWindow === null) {
			return undefined;
		}
		const left = cropWindow.left;
		const top = cropWindow.top;
		const right = cropWindow.left + cropWindow.width;
		const bottom = cropWindow.top + cropWindow.height;
		return (
			`polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ` +
			`${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ` +
			`${right}px ${top}px, ${left}px ${top}px)`
		);
	});

	function rectsClose(a: ImageCropRect, b: ImageCropRect): boolean {
		return (
			Math.abs(a.x - b.x) < RECT_EPSILON &&
			Math.abs(a.y - b.y) < RECT_EPSILON &&
			Math.abs(a.w - b.w) < RECT_EPSILON &&
			Math.abs(a.h - b.h) < RECT_EPSILON
		);
	}

	function emit(rect: ImageCropRect) {
		cropRect = rect;
		onchange?.(rect);
	}

	function handleImageLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			loadFailed = false;
			naturalRatio = img.naturalWidth / img.naturalHeight;
		}
	}

	function handleImageError() {
		loadFailed = true;
		naturalRatio = null;
	}

	function beginDrag(event: PointerEvent) {
		if (!isReady || cropWindow === null) {
			return;
		}
		event.preventDefault();
		startRect = { ...cropRect };
		startPointer = { x: event.clientX, y: event.clientY };
		dragging = true;
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging || image === null) {
			return;
		}
		// Dragging moves the image under the fixed window, so the rect shifts opposite.
		const dx = -(event.clientX - startPointer.x) / image.width;
		const dy = -(event.clientY - startPointer.y) / image.height;
		emit(panCropRect(startRect, dx, dy));
	}

	function setZoom(nextZoom: number) {
		emit(zoomCropRect(cropRect, normAspect, nextZoom));
	}

	function handleWheel(event: WheelEvent) {
		if (!isReady) {
			return;
		}
		event.preventDefault();
		setZoom(zoom + (event.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isReady) {
			return;
		}
		const panX = cropRect.w * KEYBOARD_PAN_FRACTION;
		const panY = cropRect.h * KEYBOARD_PAN_FRACTION;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-panX, 0],
			ArrowRight: [panX, 0],
			ArrowUp: [0, -panY],
			ArrowDown: [0, panY],
		};
		const move = moves[event.key];
		if (move !== undefined) {
			event.preventDefault();
			emit(panCropRect(cropRect, move[0], move[1]));
		} else if (event.key === '+') {
			event.preventDefault();
			setZoom(zoom + WHEEL_ZOOM_STEP);
		} else if (event.key === '-') {
			event.preventDefault();
			setZoom(zoom - WHEEL_ZOOM_STEP);
		}
	}

	function reset() {
		emit(centeredCropRect(normAspect));
	}

	// A spread object (rather than per-attribute ternaries) so the a11y linter
	// doesn't see an independently-conditional `tabindex` without a correlated
	// `role` – mirrors ImageFrame's `interactiveAttrs` pattern.
	const interactiveAttrs = $derived(
		interactive
			? {
					role: 'button',
					tabindex: 0,
					'aria-label': `${m.image_crop_region_label()}: ${targetLabel}`,
				}
			: {},
	);

	// Snap the bound rect to the active target's aspect once the image is measured
	// or when the target switches. Persisted per-target rects already match and pass
	// through untouched; other rects get re-shaped around their center preserving
	// their extent (#116 D5 – since round 2 an extent wider than the image restores
	// as a zoomed-out letterbox framing instead of being cropped away). The identity
	// rect is the "no framing yet" seed and snaps to the centered cover default (D1).
	// Programmatic – does not fire `onchange`.
	$effect(() => {
		// containMode (Fit preview) never snaps the bound rect – its display is
		// computed independently from `normAspect`/`containZoom` (see `displayRect`).
		if (!isReady || containMode) {
			return;
		}
		const snapped = rectsClose(cropRect, FULL_CROP_RECT)
			? centeredCropRect(normAspect)
			: fitCropRectToAspect(cropRect, normAspect);
		if (!rectsClose(snapped, cropRect)) {
			cropRect = snapped;
		}
	});

	// Track drags on the window so the rect keeps following the pointer even when it
	// leaves the stage.
	$effect(() => {
		if (!dragging) {
			return;
		}
		const stop = () => {
			dragging = false;
		};
		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', stop);
		window.addEventListener('pointercancel', stop);
		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', stop);
			window.removeEventListener('pointercancel', stop);
		};
	});

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()`
	// would be ignored and the page would scroll while zooming. Register non-passive.
	// Non-interactive (Fill/Fit preview): a wheel gesture promotes to Manual
	// instead of zooming (#183 REQ-6/7), mirroring `promoteOnWheel`.
	$effect(() => {
		const el = viewportEl;
		if (el === null) {
			return;
		}
		const listener = interactive
			? handleWheel
			: (event: WheelEvent) => {
					event.preventDefault();
					onWheelPromote?.();
				};
		el.addEventListener('wheel', listener, { passive: false });
		return () => el.removeEventListener('wheel', listener);
	});
</script>

<div class={cn('flex min-h-0 flex-col gap-2', className)}>
	<!-- WYSIWYG stage: the bright window IS the target surface (issue #116 REQ-2).
	     Interactive: pointer-drag pans, wheel/slider zooms, arrows pan from the
	     keyboard. The nested-handles a11y exception from #50 no longer applies:
	     the stage is a single focusable control with keyboard pan + a
	     keyboard-operable zoom slider. Non-interactive (#183 REQ-6/7): a static
	     preview – no focus, no drag/keyboard, only a wheel gesture (promotes to
	     Manual). -->
	<div
		bind:this={viewportEl}
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		data-testid="crop-stage"
		class={cn(
			'relative min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-surface-2 select-none',
			interactive &&
				'cursor-move touch-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
		)}
		onpointerdown={interactive ? beginDrag : undefined}
		onkeydown={interactive ? handleKeydown : undefined}
		{...interactiveAttrs}
	>
		{#if isReady && cropWindow !== null}
			<!-- Letterbox fill behind the image: where a zoomed-out window overhangs
			     the image, the same fill the renderer letterboxes with shows through. -->
			<div
				class="pointer-events-none absolute"
				style="left: {cropWindow.left}px; top: {cropWindow.top}px; width: {cropWindow.width}px; height: {cropWindow.height}px; background: {windowFill};"
			></div>
		{/if}
		<img
			{src}
			{alt}
			draggable="false"
			class={cn('pointer-events-none absolute max-w-none', !isReady && 'invisible')}
			style={image !== null
				? `left: ${image.left}px; top: ${image.top}px; width: ${image.width}px; height: ${image.height}px;`
				: undefined}
			onload={handleImageLoad}
			onerror={handleImageError}
		/>

		{#if loadFailed}
			<!-- A broken source must not present a draggable stage over a broken-image
			     glyph; show an inert placeholder instead. -->
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-foreground-subtle"
			>
				{m.gift_image_crop_load_error()}
			</div>
		{:else if isReady && cropWindow !== null}
			<!-- Dim everything outside the fixed target-shaped window -->
			<div
				class="pointer-events-none absolute inset-0 bg-black/55"
				style:clip-path={veilClipPath}
			></div>

			<!-- Window frame: target aspect, rule-of-thirds grid (interactive only,
			     #183 REQ-6/7), target + real-size chip (gift editor removes it
			     entirely, REQ-8; the wishlist editor keeps it via `showLabelChip`) -->
			<div
				data-testid="crop-stage-window"
				class="pointer-events-none absolute outline-2 outline-white/90"
				style="left: {cropWindow.left}px; top: {cropWindow.top}px; width: {cropWindow.width}px; height: {cropWindow.height}px;"
			>
				{#if interactive}
					<div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
						{#each GRID_CELLS as cell (cell)}
							<div class="border border-white/25"></div>
						{/each}
					</div>
				{/if}
				{#if showLabelChip}
					<span
						class="absolute top-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
					>
						{targetLabel}{realSizeText !== undefined ? ` · ${realSizeText}` : ''}
					</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if interactive}
		<!-- Zoom + reset -->
		<div class="flex items-center gap-3">
			<Slider
				class="flex-1"
				value={Math.round(zoom * 100)}
				min={sliderMinPercent}
				max={IMAGE_ZOOM_MAX * 100}
				step={SLIDER_STEP}
				disabled={!isReady}
				onValueChange={(value: number) => setZoom(value / 100)}
				aria-label={m.image_crop_zoom_label()}
			/>
			<span class="w-12 text-right text-xs tabular-nums text-foreground-subtle">
				{Math.round(zoom * 100)} %
			</span>
			<Button intent="ghost" size="sm" disabled={!isReady || isDefaultRect} onclick={reset}>
				<RotateCcwIcon data-icon="inline-start" />
				{m.gift_image_crop_reset()}
			</Button>
		</div>

		<span class="text-xs text-foreground-subtle">{m.image_crop_hint()}</span>
	{/if}
</div>
