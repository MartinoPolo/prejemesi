<script lang="ts">
	import { cn } from '$lib/utils.js';
	import {
		clamp01,
		type CropWindowPoint,
		type ImageCropRect,
	} from '$lib/modules/images/index.js';

	interface Props {
		/** Source image shown as the overview. */
		src: string;
		/** Normalized part of the photo the crop window currently shows. */
		region: ImageCropRect;
		/** Natural width / height of the photo; sizes the overview before it loads. */
		naturalRatio: number | null;
		disabled?: boolean;
		/** Called with the normalized photo point the user pressed or dragged to. */
		onjump: (point: CropWindowPoint) => void;
		class?: string;
	}

	let { src, region, naturalRatio, disabled = false, onjump, class: className }: Props = $props();

	const NAVIGATOR_EXTENT = 96;

	let overviewElement = $state<HTMLDivElement | null>(null);
	let dragging = false;

	// Keep the longer photo side at the navigator extent so portrait and
	// landscape photos occupy the same footprint.
	const overviewSize = $derived.by(() => {
		const ratio = naturalRatio ?? 1;
		return ratio >= 1
			? { width: NAVIGATOR_EXTENT, height: NAVIGATOR_EXTENT / ratio }
			: { width: NAVIGATOR_EXTENT * ratio, height: NAVIGATOR_EXTENT };
	});

	function jumpTo(event: PointerEvent) {
		if (overviewElement === null) {
			return;
		}
		const bounds = overviewElement.getBoundingClientRect();
		onjump({
			x: clamp01((event.clientX - bounds.left) / bounds.width),
			y: clamp01((event.clientY - bounds.top) / bounds.height),
		});
	}

	function handlePointerDown(event: PointerEvent) {
		if (disabled || event.button !== 0) {
			return;
		}
		event.preventDefault();
		overviewElement?.setPointerCapture?.(event.pointerId);
		dragging = true;
		jumpTo(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (dragging) {
			jumpTo(event);
		}
	}

	function handlePointerEnd() {
		dragging = false;
	}
</script>

<!-- Pointer shortcut only: the stage itself carries the keyboard equivalent. -->
<div
	bind:this={overviewElement}
	aria-hidden="true"
	data-testid="crop-navigator"
	class={cn(
		'relative shrink-0 overflow-hidden rounded-sm border border-border bg-crop-stage select-none',
		!disabled && 'cursor-crosshair touch-none',
		className,
	)}
	style:width="{overviewSize.width}px"
	style:height="{overviewSize.height}px"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerEnd}
	onpointercancel={handlePointerEnd}
>
	<img {src} alt="" draggable="false" class="pointer-events-none size-full opacity-60" />
	<div
		class="pointer-events-none absolute outline-2 outline-white shadow-[0_0_0_999px_rgb(0_0_0/35%)]"
		style:left="{region.x * 100}%"
		style:top="{region.y * 100}%"
		style:width="{region.w * 100}%"
		style:height="{region.h * 100}%"
	></div>
</div>
