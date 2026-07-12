<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import {
		IMAGE_ZOOM_MIN,
		IMAGE_ZOOM_MAX,
		centeredCropRect,
		cropRectToFocalZoom,
		fitCropRectToAspect,
		normalizedCropAspect,
		panCropRect,
		zoomCropRect,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';

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
		class: className,
	}: Props = $props();

	/** Padding between the viewport edge and the crop window. */
	const WINDOW_PAD = 16;
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

	// The source image drawn so that `cropRect` fills the window exactly; the rest
	// overflows dimmed. Position derives from the rect, so pan/zoom just move it.
	const image = $derived.by(() => {
		if (cropWindow === null || naturalRatio === null || cropRect.w <= 0) {
			return null;
		}
		const width = cropWindow.width / cropRect.w;
		const height = width / naturalRatio;
		return {
			width,
			height,
			left: cropWindow.left - cropRect.x * width,
			top: cropWindow.top - cropRect.y * height,
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

	// Snap the bound rect to the active target's aspect once the image is measured
	// or when the target switches. Persisted per-target rects already match and pass
	// through untouched; legacy rects get re-shaped around their center (#116 D5).
	// Programmatic – does not fire `onchange`.
	$effect(() => {
		if (!isReady) {
			return;
		}
		const snapped = fitCropRectToAspect(cropRect, normAspect);
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
	$effect(() => {
		const el = viewportEl;
		if (el === null) {
			return;
		}
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	});
</script>

<div class={cn('flex min-h-0 flex-col gap-2', className)}>
	<!-- WYSIWYG stage: the bright window IS the target surface (issue #116 REQ-2).
	     Pointer-drag pans, wheel/slider zooms, arrows pan from the keyboard. The
	     nested-handles a11y exception from #50 no longer applies: the stage is a
	     single focusable control with keyboard pan + a keyboard-operable zoom slider. -->
	<div
		bind:this={viewportEl}
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		role="button"
		tabindex="0"
		aria-label={`${m.image_crop_region_label()}: ${targetLabel}`}
		data-testid="crop-stage"
		class="relative min-h-0 w-full flex-1 cursor-move touch-none overflow-hidden rounded-lg bg-surface-2 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		onpointerdown={beginDrag}
		onkeydown={handleKeydown}
	>
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

			<!-- Window frame: target aspect, rule-of-thirds grid, target + real-size chip -->
			<div
				data-testid="crop-stage-window"
				class="pointer-events-none absolute outline-2 outline-white/90"
				style="left: {cropWindow.left}px; top: {cropWindow.top}px; width: {cropWindow.width}px; height: {cropWindow.height}px;"
			>
				<div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
					{#each GRID_CELLS as cell (cell)}
						<div class="border border-white/25"></div>
					{/each}
				</div>
				<span
					class="absolute top-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
				>
					{targetLabel}{realSizeText !== undefined ? ` · ${realSizeText}` : ''}
				</span>
			</div>
		{/if}
	</div>

	<!-- Zoom + reset -->
	<div class="flex items-center gap-3">
		<Slider
			class="flex-1"
			value={Math.round(zoom * 100)}
			min={IMAGE_ZOOM_MIN * 100}
			max={IMAGE_ZOOM_MAX * 100}
			step={5}
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
</div>
