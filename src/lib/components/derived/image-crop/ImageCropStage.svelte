<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Slider } from '$lib/components/base/slider/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import {
		FULL_CROP_RECT,
		IMAGE_EDITOR_MODES,
		IMAGE_ZOOM_MAX,
		IMAGE_ZOOM_OUT_MIN,
		alignCropRect,
		clamp01,
		centerCropRectOn,
		centeredCropRect,
		containCropRect,
		containZoomForAspect,
		cropRectToFocalZoom,
		fitCropRectToAspect,
		normalizedCropAspect,
		panCropRect,
		zoomCropRect,
		type CropWindowPoint,
		type ImageEditorMode,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';
	import {
		resolveFrameFill,
		IMAGE_TOKEN_SCOPES,
		type ImageTokenScope,
	} from '$lib/components/derived/image-frame/index.js';
	import {
		KEYBOARD_PAN_FRACTION,
		KEYBOARD_PAN_FRACTION_LARGE,
		centeredVisibleBand,
		cropWindowBox,
		photoBoxBehindWindow,
		visiblePhotoRegion,
	} from './crop_stage_geometry.js';
	import CropAnchorPad from './CropAnchorPad.svelte';
	import CropNavigator from './CropNavigator.svelte';

	interface Props {
		/** Source image being cropped. */
		src: string;
		/** Accessible description of the image. */
		alt: string;
		/** Pixel aspect ratio (width / height) of the target surface; the window keeps it. */
		targetAspect: number;
		/** Human label of the target surface, used in the stage's accessible name. */
		targetLabel: string;
		/** CSS size the target renders at on this device; the window is drawn at it (#533). */
		surfaceSize: { width: number; height: number };
		/** Normalized crop rectangle (0..1) of the manual framing, bound to the parent. */
		cropRect: ImageCropRect;
		/**
		 * What the window currently shows: the bound manual crop, the automatic
		 * centered cover (Fill) or the whole letterboxed photo (Fit). Any pan or zoom
		 * starts from what is shown and reports a manual crop through `onchange`.
		 */
		framing?: ImageEditorMode;
		/** Notified on USER edits only – never on programmatic aspect snaps. */
		onchange?: (rect: ImageCropRect) => void;
		/** Letterbox fill shown where a zoomed-out window overhangs the image (tier 1). */
		fillColor?: string | null;
		/** Scopes the tier-2 letterbox fill token, mirroring ImageFrame. */
		tokenScope?: ImageTokenScope;
		/** Prevents crop edits while keeping the layout. */
		disabled?: boolean;
		/**
		 * Fraction of the window width a narrower consumer frame still shows as a
		 * centered side-window; the clipped sides are hatched (mobile List rows).
		 */
		visibleWidthFraction?: number | null;
		/** Leading content of the row above the stage, e.g. which target is edited. */
		heading?: Snippet;
		/** Sizes the dark stage; the window scales down only when it cannot fit. */
		stageClass?: string;
		class?: string;
	}

	let {
		src,
		alt,
		targetAspect,
		targetLabel,
		surfaceSize,
		cropRect = $bindable(),
		framing = IMAGE_EDITOR_MODES.manual,
		onchange,
		fillColor = null,
		tokenScope = IMAGE_TOKEN_SCOPES.global,
		disabled = false,
		visibleWidthFraction = null,
		heading,
		stageClass,
		class: className,
	}: Props = $props();

	// Narrow stages trade breathing room for a larger window.
	const WINDOW_PADDING = 28;
	const COMPACT_WINDOW_PADDING = 12;
	const COMPACT_STAGE_WIDTH = 480;
	const SLIDER_STEP = 5;
	const BUTTON_ZOOM_STEP = 0.1;
	const WHEEL_ZOOM_SENSITIVITY = 0.0015;
	const INTERACTION_LINGER_MS = 700;
	const HINT_CLEARANCE = 26;
	// Sub-percent layout rounding still counts as drawn at true size.
	const TRUE_SIZE_SCALE_TOLERANCE = 0.995;
	const RECT_EPSILON = 1e-3;
	const GRID_CELLS = Array.from({ length: 9 }, (_unused, index) => index);
	const GHOST_STORAGE_KEY = 'prejemesi:image-crop-ghost';

	const keyboardHintId = $props.id();

	let stageElement = $state<HTMLDivElement | null>(null);
	let stageWidth = $state(0);
	let stageHeight = $state(0);
	let naturalRatio = $state<number | null>(null);
	let loadFailed = $state(false);
	let interacting = $state(false);
	let showGhost = $state(readGhostPreference());

	// Pointer bookkeeping – only read inside handlers.
	const activePointers = new SvelteMap<number, { x: number; y: number }>();
	let pinchDistance: number | null = null;
	let lingerTimer: ReturnType<typeof setTimeout> | undefined;

	const isReady = $derived(!loadFailed && naturalRatio !== null);
	const controlsDisabled = $derived(disabled || !isReady);
	const normalizedAspect = $derived(normalizedCropAspect(targetAspect, naturalRatio ?? 1));
	// Before the image is measured the real contain floor is unknown; the absolute
	// floor keeps the native range input from clamping a legal seeded zoom upward.
	const containZoom = $derived(
		isReady ? containZoomForAspect(normalizedAspect) : IMAGE_ZOOM_OUT_MIN,
	);
	const sliderMinPercent = $derived(
		100 - SLIDER_STEP * Math.floor((100 - Math.ceil(containZoom * 100)) / SLIDER_STEP),
	);

	/** The framing the window shows right now; every edit starts from it. */
	const shownRect = $derived.by((): ImageCropRect => {
		if (framing === IMAGE_EDITOR_MODES.fit) {
			return containCropRect(normalizedAspect);
		}
		if (framing === IMAGE_EDITOR_MODES.fill) {
			return centeredCropRect(normalizedAspect);
		}
		return cropRect;
	});
	const zoom = $derived(cropRectToFocalZoom(shownRect).zoom);
	const isCentered = $derived(rectsClose(shownRect, centeredCropRect(normalizedAspect)));
	const isWhole = $derived(rectsClose(shownRect, containCropRect(normalizedAspect)));

	const windowBox = $derived(
		cropWindowBox(
			{ width: stageWidth, height: stageHeight },
			surfaceSize,
			stageWidth < COMPACT_STAGE_WIDTH ? COMPACT_WINDOW_PADDING : WINDOW_PADDING,
		),
	);
	const photoBox = $derived(
		windowBox !== null ? photoBoxBehindWindow(shownRect, windowBox) : null,
	);
	const windowFill = $derived(resolveFrameFill({ fillColor, tokenScope }));
	const sizeLabel = $derived(
		windowBox === null || windowBox.scale >= TRUE_SIZE_SCALE_TOLERANCE
			? m.image_crop_true_size({ width: surfaceSize.width, height: surfaceSize.height })
			: m.image_crop_scaled_size({
					width: surfaceSize.width,
					height: surfaceSize.height,
					percent: Math.round(windowBox.scale * 100),
				}),
	);
	const showHintInside = $derived(
		windowBox !== null && stageHeight - (windowBox.top + windowBox.height) >= HINT_CLEARANCE,
	);
	const band = $derived(
		visibleWidthFraction !== null &&
			visibleWidthFraction < 1 &&
			framing !== IMAGE_EDITOR_MODES.fit
			? centeredVisibleBand(visibleWidthFraction)
			: null,
	);
	// Outside the window the stage color covers the photo: dimmed with the ghost on,
	// opaque with it off. The polygon's second ring punches the window out.
	const veilClipPath = $derived.by(() => {
		if (windowBox === null) {
			return undefined;
		}
		const right = windowBox.left + windowBox.width;
		const bottom = windowBox.top + windowBox.height;
		return (
			`polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ` +
			`${windowBox.left}px ${windowBox.top}px, ${windowBox.left}px ${bottom}px, ` +
			`${right}px ${bottom}px, ${right}px ${windowBox.top}px, ${windowBox.left}px ${windowBox.top}px)`
		);
	});

	function readGhostPreference(): boolean {
		try {
			return globalThis.localStorage?.getItem(GHOST_STORAGE_KEY) !== 'off';
		} catch {
			return true;
		}
	}

	function setGhostPreference(next: boolean) {
		showGhost = next;
		try {
			globalThis.localStorage?.setItem(GHOST_STORAGE_KEY, next ? 'on' : 'off');
		} catch {
			// Storage can be unavailable (private mode); the toggle still works for this session.
		}
	}

	function rectsClose(a: ImageCropRect, b: ImageCropRect): boolean {
		return (
			Math.abs(a.x - b.x) < RECT_EPSILON &&
			Math.abs(a.y - b.y) < RECT_EPSILON &&
			Math.abs(a.w - b.w) < RECT_EPSILON &&
			Math.abs(a.h - b.h) < RECT_EPSILON
		);
	}

	function emit(rect: ImageCropRect) {
		// A clamped no-op (e.g. panning against an edge) must not promote or dirty the form.
		if (controlsDisabled || rectsClose(rect, shownRect)) {
			return;
		}
		cropRect = rect;
		onchange?.(rect);
	}

	function markInteracting() {
		interacting = true;
		clearTimeout(lingerTimer);
		lingerTimer = setTimeout(() => {
			if (activePointers.size === 0) {
				interacting = false;
			}
		}, INTERACTION_LINGER_MS);
	}

	function panByPixels(deltaX: number, deltaY: number) {
		if (windowBox === null) {
			return;
		}
		// The photo follows the pointer, so the crop moves the opposite way.
		const rect = shownRect;
		emit(
			panCropRect(
				rect,
				(-deltaX * rect.w) / windowBox.width,
				(-deltaY * rect.h) / windowBox.height,
			),
		);
	}

	function zoomTo(nextZoom: number, anchor?: CropWindowPoint) {
		emit(zoomCropRect(shownRect, normalizedAspect, nextZoom, anchor));
	}

	/** Window-relative position of a client point, clamped to the window. */
	function windowPointAt(clientX: number, clientY: number): CropWindowPoint | undefined {
		if (stageElement === null || windowBox === null) {
			return undefined;
		}
		const bounds = stageElement.getBoundingClientRect();
		return {
			x: clamp01((clientX - bounds.left - windowBox.left) / windowBox.width),
			y: clamp01((clientY - bounds.top - windowBox.top) / windowBox.height),
		};
	}

	function handleImageLoad(event: Event) {
		const image = event.currentTarget as HTMLImageElement;
		if (image.naturalWidth > 0 && image.naturalHeight > 0) {
			loadFailed = false;
			naturalRatio = image.naturalWidth / image.naturalHeight;
		}
	}

	function handleImageError() {
		loadFailed = true;
		naturalRatio = null;
	}

	function handlePointerDown(event: PointerEvent) {
		if (controlsDisabled || event.button !== 0) {
			return;
		}
		event.preventDefault();
		stageElement?.focus({ preventScroll: true });
		stageElement?.setPointerCapture?.(event.pointerId);
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		pinchDistance = null;
		interacting = true;
	}

	function handlePointerMove(event: PointerEvent) {
		const previous = activePointers.get(event.pointerId);
		if (previous === undefined) {
			return;
		}
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (activePointers.size === 1) {
			panByPixels(event.clientX - previous.x, event.clientY - previous.y);
			return;
		}
		const [first, second] = [...activePointers.values()];
		const distance = Math.hypot(first.x - second.x, first.y - second.y);
		if (pinchDistance !== null && pinchDistance > 0) {
			const midpoint = windowPointAt((first.x + second.x) / 2, (first.y + second.y) / 2);
			zoomTo((zoom * distance) / pinchDistance, midpoint);
		}
		pinchDistance = distance;
	}

	function handlePointerEnd(event: PointerEvent) {
		activePointers.delete(event.pointerId);
		pinchDistance = null;
		if (activePointers.size === 0) {
			markInteracting();
		}
	}

	function handleWheel(event: WheelEvent) {
		if (controlsDisabled) {
			return;
		}
		event.preventDefault();
		markInteracting();
		zoomTo(
			zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY),
			windowPointAt(event.clientX, event.clientY),
		);
	}

	function handleKeydown(event: KeyboardEvent) {
		// Leave browser and OS shortcuts such as Ctrl/Cmd + "+" to the browser.
		if (controlsDisabled || event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}
		const fraction = event.shiftKey ? KEYBOARD_PAN_FRACTION_LARGE : KEYBOARD_PAN_FRACTION;
		const rect = shownRect;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-rect.w * fraction, 0],
			ArrowRight: [rect.w * fraction, 0],
			ArrowUp: [0, -rect.h * fraction],
			ArrowDown: [0, rect.h * fraction],
		};
		const move = moves[event.key];
		if (move !== undefined) {
			emit(panCropRect(rect, move[0], move[1]));
		} else if (event.key === '+' || event.key === '=') {
			zoomTo(zoom + BUTTON_ZOOM_STEP);
		} else if (event.key === '-') {
			zoomTo(zoom - BUTTON_ZOOM_STEP);
		} else if (event.key === '0') {
			recenter();
		} else {
			return;
		}
		event.preventDefault();
	}

	function recenter() {
		emit(centeredCropRect(normalizedAspect));
	}

	function showWhole() {
		emit(containCropRect(normalizedAspect));
	}

	// Snap the bound manual rect to the target's aspect once the image is measured
	// or the target switches. Persisted per-target rects already match and pass
	// through untouched; the identity rect is the "no framing yet" seed and becomes
	// the centered cover default. Programmatic – does not fire `onchange`.
	$effect(() => {
		if (!isReady || framing !== IMAGE_EDITOR_MODES.manual) {
			return;
		}
		const snapped = rectsClose(cropRect, FULL_CROP_RECT)
			? centeredCropRect(normalizedAspect)
			: fitCropRectToAspect(cropRect, normalizedAspect);
		if (!rectsClose(snapped, cropRect)) {
			cropRect = snapped;
		}
	});

	// Svelte attaches inline `onwheel` as a passive listener, so `preventDefault()`
	// would be ignored and the page would scroll while zooming. Register non-passive.
	$effect(() => {
		const element = stageElement;
		if (element === null) {
			return;
		}
		element.addEventListener('wheel', handleWheel, { passive: false });
		return () => element.removeEventListener('wheel', handleWheel);
	});

	$effect(() => () => clearTimeout(lingerTimer));
</script>

<div class={cn('flex min-h-0 flex-col gap-2', className)}>
	<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
		<div class="min-w-0 text-xs text-muted-foreground">{@render heading?.()}</div>
		<label class="flex items-center gap-2 text-xs text-muted-foreground">
			<Switch
				size="sm"
				checked={showGhost}
				onCheckedChange={setGhostPreference}
				data-testid="crop-stage-ghost-toggle"
			/>
			{m.image_crop_ghost_toggle()}
		</label>
	</div>

	<!-- The window is drawn at the target's real CSS size and stays put; the photo
	     pans and zooms behind it (#533). The stage is one focusable control: pointer
	     drag pans, wheel/pinch zooms around the pointer, arrows/+/−/0 work from the
	     keyboard. Svelte's a11y table does not count `application` as interactive. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={stageElement}
		bind:clientWidth={stageWidth}
		bind:clientHeight={stageHeight}
		data-testid="crop-stage"
		role="application"
		tabindex={disabled ? -1 : 0}
		aria-label={`${m.image_crop_region_label()}: ${targetLabel}`}
		aria-describedby={keyboardHintId}
		aria-disabled={disabled}
		class={cn(
			'relative min-h-0 w-full overflow-hidden rounded-lg bg-crop-stage select-none',
			'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
			!disabled && 'cursor-grab touch-none',
			!disabled && interacting && 'cursor-grabbing',
			stageClass,
		)}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerEnd}
		onpointercancel={handlePointerEnd}
		ondblclick={() => recenter()}
		onkeydown={handleKeydown}
	>
		{#if isReady && windowBox !== null}
			<!-- Letterbox fill behind the window, identical to the renderer's frame fill. -->
			<div
				class="pointer-events-none absolute"
				style="left: {windowBox.left}px; top: {windowBox.top}px; width: {windowBox.width}px; height: {windowBox.height}px; background: {windowFill};"
			></div>
		{/if}

		<!-- The whole photo, always mounted so it can load and measure. -->
		<img
			{src}
			{alt}
			draggable="false"
			class={cn('pointer-events-none absolute block max-w-none', !isReady && 'invisible')}
			style={photoBox !== null
				? `left: ${photoBox.left}px; top: ${photoBox.top}px; width: ${photoBox.width}px; height: ${photoBox.height}px;`
				: undefined}
			onload={handleImageLoad}
			onerror={handleImageError}
		/>

		{#if loadFailed}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/80"
			>
				{m.gift_image_crop_load_error()}
			</div>
		{:else if isReady && windowBox !== null}
			<div
				class={cn(
					'pointer-events-none absolute inset-0 transition-[background-color] duration-200',
					showGhost ? 'bg-crop-stage/65' : 'bg-crop-stage',
				)}
				style:clip-path={veilClipPath}
				data-testid="crop-stage-veil"
			></div>

			<div
				data-testid="crop-stage-window"
				class="pointer-events-none absolute outline-2 outline-white/90"
				style="left: {windowBox.left}px; top: {windowBox.top}px; width: {windowBox.width}px; height: {windowBox.height}px;"
			>
				{#if band !== null}
					<!-- The sides a narrower consumer frame clips away stay visible but hatched. -->
					<div
						class="crop-band-clipped absolute inset-y-0 left-0 border-r border-dashed border-white/80"
						style:width="{band.from * 100}%"
						data-testid="crop-stage-clipped-band"
					></div>
					<div
						class="crop-band-clipped absolute inset-y-0 right-0 border-l border-dashed border-white/80"
						style:width="{(1 - band.to) * 100}%"
					></div>
				{/if}
				{#if interacting}
					<div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
						{#each GRID_CELLS as cell (cell)}
							<div class="border border-white/25"></div>
						{/each}
					</div>
				{/if}
			</div>

			<span
				class="pointer-events-none absolute max-w-[calc(100%-1rem)] truncate rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white"
				style="left: {windowBox.left}px; top: {Math.max(4, windowBox.top - 24)}px;"
				data-testid="crop-stage-size"
			>
				{sizeLabel}
			</span>

			{#if showHintInside}
				<span
					class="pointer-events-none absolute inset-x-2 bottom-1.5 truncate text-center text-[11px] text-white/75"
					aria-hidden="true"
				>
					{m.image_crop_hint()}
				</span>
			{/if}
		{/if}
	</div>

	<p id={keyboardHintId} class={cn('text-xs text-muted-foreground', showHintInside && 'sr-only')}>
		{#if !showHintInside}{m.image_crop_hint()}{/if}
		<span class="sr-only">{m.image_crop_keyboard_hint()}</span>
	</p>

	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-2">
			<Button
				intent="outline"
				size="sm"
				format="icon"
				disabled={controlsDisabled || zoom <= containZoom + RECT_EPSILON}
				onclick={() => zoomTo(zoom - BUTTON_ZOOM_STEP)}
				aria-label={m.image_crop_zoom_out()}
			>
				<MinusIcon data-icon="solo" />
			</Button>
			<Slider
				class="min-w-16 flex-1"
				value={Math.round(zoom * 100)}
				min={sliderMinPercent}
				max={IMAGE_ZOOM_MAX * 100}
				step={SLIDER_STEP}
				disabled={controlsDisabled}
				onValueChange={(value: number) => zoomTo(value / 100)}
				aria-label={m.image_crop_zoom_label()}
			/>
			<Button
				intent="outline"
				size="sm"
				format="icon"
				disabled={controlsDisabled || zoom >= IMAGE_ZOOM_MAX - RECT_EPSILON}
				onclick={() => zoomTo(zoom + BUTTON_ZOOM_STEP)}
				aria-label={m.image_crop_zoom_in()}
			>
				<PlusIcon data-icon="solo" />
			</Button>
			<span
				class="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
				data-testid="crop-stage-zoom"
			>
				{Math.round(zoom * 100)} %
			</span>
		</div>
		<div class="flex items-center gap-3">
			<CropNavigator
				{src}
				region={visiblePhotoRegion(shownRect)}
				{naturalRatio}
				disabled={controlsDisabled}
				onjump={(point) => emit(centerCropRectOn(shownRect, point))}
			/>
			<div class="flex min-w-0 flex-1 flex-wrap gap-(--nested-control-gap)">
				<Button
					intent="outline"
					size="sm"
					disabled={controlsDisabled || isWhole}
					onclick={showWhole}
				>
					{m.image_crop_whole()}
				</Button>
				<Button
					intent="outline"
					size="sm"
					disabled={controlsDisabled || isCentered}
					onclick={recenter}
				>
					{m.image_crop_center()}
				</Button>
			</div>
			<CropAnchorPad
				disabled={controlsDisabled}
				onalign={(alignment) => emit(alignCropRect(shownRect, alignment))}
			/>
		</div>
	</div>
</div>

<style>
	.crop-band-clipped {
		background: repeating-linear-gradient(
			-45deg,
			rgb(0 0 0 / 45%) 0 6px,
			rgb(255 255 255 / 18%) 6px 9px
		);
	}
</style>
