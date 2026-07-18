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

	// ── Adaptive stage geometry (#189) ────────────────────────────────────────
	// Inverted from #116/#183: the WHOLE photo renders contained and is always fully
	// visible; the target window overlays it (Fill/Manual). Fit keeps a centered
	// target-aspect window with the whole photo letterboxed inside it. The parent
	// sizes the stage to the photo's natural aspect (capped), so the contained photo
	// nearly fills it; a zoom-in shrinks the window (tighter crop), never the photo.

	/** The largest `aspect`-ratio box that fits inside `box` (contain), centered. */
	function containRect(
		box: { left: number; top: number; width: number; height: number },
		aspect: number,
	) {
		const heightBinds = box.width / box.height >= aspect;
		const width = heightBinds ? box.height * aspect : box.width;
		const height = heightBinds ? box.height : box.width / aspect;
		return {
			width,
			height,
			left: box.left + (box.width - width) / 2,
			top: box.top + (box.height - height) / 2,
		};
	}

	// Fill/Manual: the whole photo, contained + centered, inset by WINDOW_PAD. Its
	// aspect always equals `naturalRatio`, so the projected window below lands at the
	// exact target pixel aspect on screen (WYSIWYG).
	const photoRect = $derived.by(() => {
		if (naturalRatio === null) {
			return null;
		}
		const availW = viewportWidth - 2 * WINDOW_PAD;
		const availH = viewportHeight - 2 * WINDOW_PAD;
		if (availW <= 0 || availH <= 0) {
			return null;
		}
		return containRect(
			{ left: WINDOW_PAD, top: WINDOW_PAD, width: availW, height: availH },
			naturalRatio,
		);
	});

	// The active target's window = the crop rect projected onto the contained photo.
	// `cropRect` is locked to `normAspect` (snap effect below) and the photo carries
	// `naturalRatio`, so the window is exactly `targetAspect` on screen. A zoomed-out
	// crop (rect past 0..1) overhangs the photo → the overhang shows the letterbox
	// fill, matching the renderer.
	const cropWindowRect = $derived.by(() => {
		if (photoRect === null) {
			return null;
		}
		return {
			width: cropRect.w * photoRect.width,
			height: cropRect.h * photoRect.height,
			left: photoRect.left + cropRect.x * photoRect.width,
			top: photoRect.top + cropRect.y * photoRect.height,
		};
	});

	// Fit (Přizpůsobit, non-interactive): a centered target-aspect window with the
	// WHOLE photo letterboxed inside it — largest target box that fits the viewport.
	const fitWindow = $derived.by(() => {
		if (!containMode) {
			return null;
		}
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

	// The whole photo contained inside the Fit window (letterboxed on one axis).
	const fitPhoto = $derived(
		fitWindow !== null && naturalRatio !== null ? containRect(fitWindow, naturalRatio) : null,
	);

	// The single always-mounted <img>: at the contained photo (Fill/Manual) or
	// letterboxed inside the Fit window (Fit).
	const imageRect = $derived(containMode ? fitPhoto : photoRect);
	// The framed window (outline + grid + chip): the projected crop (Fill/Manual) or
	// the centered Fit window.
	const activeWindowRect = $derived(containMode ? fitWindow : cropWindowRect);

	const zoom = $derived(cropRectToFocalZoom(cropRect).zoom);
	const isDefaultRect = $derived.by(() => {
		const defaultRect = centeredCropRect(normAspect);
		return rectsClose(cropRect, defaultRect);
	});

	// Veil: an `outer` rectangle with a rectangular `hole` punched at the window.
	// The veil element spans the viewport; the polygon's outer ring decides how far
	// the dimming reaches (Fill/Manual dims only the photo; Fit dims the whole stage).
	function holeClipPath(
		outer: { left: number; top: number; width: number; height: number },
		hole: { left: number; top: number; width: number; height: number },
	): string {
		const ol = outer.left;
		const ot = outer.top;
		const or = outer.left + outer.width;
		const ob = outer.top + outer.height;
		const hl = hole.left;
		const ht = hole.top;
		const hr = hole.left + hole.width;
		const hb = hole.top + hole.height;
		return (
			`polygon(${ol}px ${ot}px, ${or}px ${ot}px, ${or}px ${ob}px, ${ol}px ${ob}px, ${ol}px ${ot}px, ` +
			`${hl}px ${ht}px, ${hl}px ${hb}px, ${hr}px ${hb}px, ${hr}px ${ht}px, ${hl}px ${ht}px)`
		);
	}

	// Fill/Manual: dim only the photo OUTSIDE the window — the outer ring is the photo
	// rect, so the mat beyond the photo stays undimmed; overhang is dimmed, never clipped.
	const fillVeilClipPath = $derived(
		photoRect !== null && cropWindowRect !== null
			? holeClipPath(photoRect, cropWindowRect)
			: undefined,
	);
	// Fit: dim the whole stage outside the centered target window.
	const fitVeilClipPath = $derived(
		fitWindow !== null
			? holeClipPath(
					{ left: 0, top: 0, width: viewportWidth, height: viewportHeight },
					fitWindow,
				)
			: undefined,
	);

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
		if (!isReady || photoRect === null) {
			return;
		}
		event.preventDefault();
		startRect = { ...cropRect };
		startPointer = { x: event.clientX, y: event.clientY };
		dragging = true;
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging || photoRect === null) {
			return;
		}
		// The photo is fixed and fully visible; dragging moves the WINDOW over it, so
		// the crop rect shifts WITH the pointer.
		const dx = (event.clientX - startPointer.x) / photoRect.width;
		const dy = (event.clientY - startPointer.y) / photoRect.height;
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
		// computed independently (see `fitWindow`/`fitPhoto`).
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
		<!-- Letterbox fill behind the window: where a zoomed-out window overhangs the
		     photo (Fill/Manual) or around the letterboxed photo (Fit), the renderer's
		     fill shows through. -->
		{#if isReady && !containMode && cropWindowRect !== null}
			<div
				class="pointer-events-none absolute"
				style="left: {cropWindowRect.left}px; top: {cropWindowRect.top}px; width: {cropWindowRect.width}px; height: {cropWindowRect.height}px; background: {windowFill};"
			></div>
		{/if}
		{#if isReady && containMode && fitWindow !== null}
			<div
				class="pointer-events-none absolute"
				style="left: {fitWindow.left}px; top: {fitWindow.top}px; width: {fitWindow.width}px; height: {fitWindow.height}px; background: {windowFill};"
			></div>
		{/if}

		<!-- The whole photo: always mounted so it can load; contained and fully visible
		     (Fill/Manual) or letterboxed inside the Fit window (Fit). -->
		<img
			{src}
			{alt}
			draggable="false"
			class={cn('pointer-events-none absolute block max-w-none', !isReady && 'invisible')}
			style={imageRect !== null
				? `left: ${imageRect.left}px; top: ${imageRect.top}px; width: ${imageRect.width}px; height: ${imageRect.height}px;`
				: undefined}
			onload={handleImageLoad}
			onerror={handleImageError}
		/>

		{#if loadFailed}
			<!-- A broken source must not present a draggable stage over a broken-image
			     glyph; show an inert placeholder instead. -->
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground"
			>
				{m.gift_image_crop_load_error()}
			</div>
		{:else if isReady && activeWindowRect !== null}
			<!-- Dim the overhang: Fill/Manual dims only the photo OUTSIDE the window
			     (the mat beyond the photo stays clean); Fit dims the whole stage outside
			     the target window. The full photo is never clipped at default zoom. -->
			<div
				class="pointer-events-none absolute inset-0 bg-black/55"
				style:clip-path={containMode ? fitVeilClipPath : fillVeilClipPath}
			></div>

			<!-- Window frame: the active target's region only (#189), rule-of-thirds grid
			     (interactive only, #183 REQ-6/7), target + real-size chip (gift editor
			     removes it via `showLabelChip={false}`; the wishlist editor keeps it).
			     Drawn at the window rect so its outline shows even over letterbox overhang. -->
			<div
				data-testid="crop-stage-window"
				class="pointer-events-none absolute outline-2 outline-white/90"
				style="left: {activeWindowRect.left}px; top: {activeWindowRect.top}px; width: {activeWindowRect.width}px; height: {activeWindowRect.height}px;"
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
			<span class="w-12 text-right text-xs tabular-nums text-muted-foreground">
				{Math.round(zoom * 100)} %
			</span>
			<Button intent="ghost" size="sm" disabled={!isReady || isDefaultRect} onclick={reset}>
				<RotateCcwIcon data-icon="inline-start" />
				{m.gift_image_crop_reset()}
			</Button>
		</div>

		<span class="text-xs text-muted-foreground">{m.image_crop_hint()}</span>
	{/if}
</div>
