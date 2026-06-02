<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/base/button/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import type { ImageCropRect } from '$lib/modules/images/index.js';

	interface Props {
		/** Source image displayed beneath the crop rectangle. */
		src: string;
		/** Accessible description of the image being cropped. */
		alt: string;
		/** Normalized crop rectangle (0..1), bound to the parent. */
		cropRect: ImageCropRect;
		/** Notified whenever the rectangle changes (drag, resize, reset). */
		onchange?: (rect: ImageCropRect) => void;
		class?: string;
	}

	let { src, alt, cropRect = $bindable(), onchange, class: className }: Props = $props();

	const FULL_FRAME: ImageCropRect = { x: 0, y: 0, w: 1, h: 1 };
	const MIN_SIZE = 0.05;
	/** Drag handles: corners resize both axes, edges resize one (REQ-3). */
	const HANDLES = [
		{ id: 'nw', class: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
		{ id: 'n', class: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
		{ id: 'ne', class: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
		{ id: 'e', class: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
		{ id: 'se', class: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
		{ id: 's', class: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
		{ id: 'sw', class: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
		{ id: 'w', class: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
	] as const;
	type HandleId = (typeof HANDLES)[number]['id'];
	type DragMode = 'move' | HandleId;

	const GRID_CELLS = Array.from({ length: 9 }, (_unused, index) => index);

	let stageEl = $state<HTMLDivElement | null>(null);
	let naturalRatio = $state<number | null>(null);
	let dragging = $state(false);

	// drag bookkeeping (plain, non-reactive — only read inside pointer handlers)
	let mode: DragMode = 'move';
	let startRect: ImageCropRect = FULL_FRAME;
	let startPointer = { x: 0, y: 0 };

	// Stage matches the image's natural ratio so crop coords map 1:1 to image space
	// (no letterbox bars). Width-bound for landscape, height-bound (≤280px) for portrait.
	const stageStyle = $derived.by(() => {
		if (naturalRatio === null) {
			return 'aspect-ratio: 3 / 2; width: 100%;';
		}
		return naturalRatio >= 1
			? `aspect-ratio: ${naturalRatio}; width: 100%; max-width: ${280 * naturalRatio}px;`
			: `aspect-ratio: ${naturalRatio}; height: 280px;`;
	});

	const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

	function emit(rect: ImageCropRect) {
		cropRect = rect;
		onchange?.(rect);
	}

	function handleImageLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			naturalRatio = img.naturalWidth / img.naturalHeight;
		}
	}

	function beginDrag(event: PointerEvent, dragMode: DragMode) {
		if (stageEl === null) {
			return;
		}
		event.preventDefault();
		mode = dragMode;
		startRect = { ...cropRect };
		startPointer = { x: event.clientX, y: event.clientY };
		dragging = true;
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging || stageEl === null) {
			return;
		}
		const bounds = stageEl.getBoundingClientRect();
		if (bounds.width === 0 || bounds.height === 0) {
			return;
		}
		const dx = (event.clientX - startPointer.x) / bounds.width;
		const dy = (event.clientY - startPointer.y) / bounds.height;
		emit(nextRect(dx, dy));
	}

	/** Apply a normalized pointer delta to the start rect for the active drag mode. */
	function nextRect(dx: number, dy: number): ImageCropRect {
		const r = { ...startRect };
		if (mode === 'move') {
			r.x = clamp01(startRect.x + dx);
			r.y = clamp01(startRect.y + dy);
			// keep the rect fully inside the frame
			r.x = Math.min(r.x, 1 - startRect.w);
			r.y = Math.min(r.y, 1 - startRect.h);
			return r;
		}
		const right = startRect.x + startRect.w;
		const bottom = startRect.y + startRect.h;
		if (mode.includes('w')) {
			r.x = clamp01(Math.min(startRect.x + dx, right - MIN_SIZE));
			r.w = right - r.x;
		}
		if (mode.includes('e')) {
			r.w = Math.max(MIN_SIZE, Math.min(startRect.w + dx, 1 - startRect.x));
		}
		if (mode.includes('n')) {
			r.y = clamp01(Math.min(startRect.y + dy, bottom - MIN_SIZE));
			r.h = bottom - r.y;
		}
		if (mode.includes('s')) {
			r.h = Math.max(MIN_SIZE, Math.min(startRect.h + dy, 1 - startRect.y));
		}
		return r;
	}

	function reset() {
		emit({ ...FULL_FRAME });
	}

	const isFullFrame = $derived(
		cropRect.x === 0 && cropRect.y === 0 && cropRect.w === 1 && cropRect.h === 1,
	);

	// Track drags on the window so the rect keeps following the pointer even when it
	// leaves the stage, and so the stage element needs no static-element interactions.
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
</script>

<div class={cn('flex flex-col gap-2', className)}>
	<div class="flex justify-center">
		<!-- Stage: source image with the crop overlay. Pointer events drive the rect. -->
		<div
			bind:this={stageEl}
			class="relative max-w-full overflow-hidden rounded-lg bg-surface-2 select-none"
			style={stageStyle}
		>
			<img
				{src}
				{alt}
				class="pointer-events-none size-full object-cover"
				onload={handleImageLoad}
			/>

			<!-- Dimmed mask outside the crop region -->
			<div
				class="pointer-events-none absolute inset-0 bg-black/55"
				style="clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, {cropRect.x *
					100}% {cropRect.y * 100}%, {cropRect.x * 100}% {(cropRect.y + cropRect.h) *
					100}%, {(cropRect.x + cropRect.w) * 100}% {(cropRect.y + cropRect.h) *
					100}%, {(cropRect.x + cropRect.w) * 100}% {cropRect.y * 100}%, {cropRect.x *
					100}% {cropRect.y * 100}%);"
			></div>

			<!-- Crop rectangle: draggable body + rule-of-thirds grid + handles -->
			<div
				role="button"
				tabindex="0"
				aria-label={m.gift_image_crop_region_label()}
				class="absolute cursor-move outline-2 outline-white/90 focus-visible:outline-ring"
				style="left: {cropRect.x * 100}%; top: {cropRect.y * 100}%; width: {cropRect.w *
					100}%; height: {cropRect.h * 100}%;"
				onpointerdown={(event) => beginDrag(event, 'move')}
			>
				<div class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
					{#each GRID_CELLS as cell (cell)}
						<div class="border border-white/25"></div>
					{/each}
				</div>
				{#each HANDLES as handle (handle.id)}
					<button
						type="button"
						aria-label={handle.id}
						class={cn(
							'absolute size-3 rounded-full bg-white shadow outline-1 outline-black/40',
							handle.class,
						)}
						onpointerdown={(event) => {
							event.stopPropagation();
							beginDrag(event, handle.id);
						}}
					></button>
				{/each}
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between gap-2">
		<span class="text-xs text-foreground-subtle">{m.gift_image_crop_hint()}</span>
		<Button intent="ghost" size="sm" disabled={isFullFrame} onclick={reset}>
			<RotateCcwIcon data-icon="inline-start" />
			{m.gift_image_crop_reset()}
		</Button>
	</div>
</div>
