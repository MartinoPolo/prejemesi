<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		KEYBOARD_PAN_FRACTION,
		KEYBOARD_PAN_FRACTION_LARGE,
	} from '$lib/components/derived/image-crop/crop_stage_geometry.js';

	interface FocalPoint {
		x: number;
		y: number;
	}

	interface WishlistBackgroundFocalPickerProps {
		imageUrl: string;
		focal: FocalPoint;
		onchange: (focal: FocalPoint) => void;
		disabled?: boolean;
		describedBy?: string;
	}

	let {
		imageUrl,
		focal,
		onchange,
		disabled = false,
		describedBy,
	}: WishlistBackgroundFocalPickerProps = $props();

	let frameElement = $state<HTMLElement | null>(null);
	let handleElement = $state<HTMLButtonElement | null>(null);
	let draggingPointerId = $state<number | null>(null);

	function clampPercent(value: number): number {
		return Math.round(Math.min(100, Math.max(0, value)));
	}

	function focalFromPointer(event: PointerEvent): FocalPoint | null {
		const bounds = frameElement?.getBoundingClientRect();
		if (bounds === undefined || bounds.width === 0 || bounds.height === 0) {
			return null;
		}
		return {
			x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
			y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100),
		};
	}

	function moveTo(event: PointerEvent) {
		const next = focalFromPointer(event);
		if (next !== null && (next.x !== focal.x || next.y !== focal.y)) {
			onchange(next);
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (disabled || event.button !== 0) {
			return;
		}
		event.preventDefault();
		frameElement?.setPointerCapture(event.pointerId);
		draggingPointerId = event.pointerId;
		handleElement?.focus();
		moveTo(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId === draggingPointerId) {
			moveTo(event);
		}
	}

	function handlePointerEnd(event: PointerEvent) {
		if (event.pointerId === draggingPointerId) {
			draggingPointerId = null;
		}
	}

	const KEY_DIRECTIONS: Record<string, FocalPoint> = {
		ArrowLeft: { x: -1, y: 0 },
		ArrowRight: { x: 1, y: 0 },
		ArrowUp: { x: 0, y: -1 },
		ArrowDown: { x: 0, y: 1 },
	};

	function handleKeyDown(event: KeyboardEvent) {
		const direction = KEY_DIRECTIONS[event.key];
		if (disabled || direction === undefined) {
			return;
		}
		event.preventDefault();
		const step = 100 * (event.shiftKey ? KEYBOARD_PAN_FRACTION_LARGE : KEYBOARD_PAN_FRACTION);
		onchange({
			x: clampPercent(focal.x + direction.x * step),
			y: clampPercent(focal.y + direction.y * step),
		});
	}
</script>

<!-- The frame hugs the image so pointer percentages map straight onto the photo. The handle is the
     keyboard and screen-reader control; the frame only adds pointer placement. -->
<div class="flex justify-center rounded-lg border-2 border-ink bg-muted p-2">
	<div
		bind:this={frameElement}
		class="relative inline-block max-w-full cursor-crosshair touch-none select-none data-[disabled]:cursor-not-allowed"
		data-disabled={disabled ? '' : undefined}
		data-testid="wishlist-background-focal-frame"
		role="presentation"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerEnd}
		onpointercancel={handlePointerEnd}
		onlostpointercapture={handlePointerEnd}
	>
		<img src={imageUrl} alt="" draggable="false" class="block max-h-56 max-w-full rounded-sm" />
		<button
			bind:this={handleElement}
			type="button"
			class="absolute size-7 -translate-1/2 rounded-full border-[3px] border-card bg-ink/40 shadow-[0_0_0_2px_var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			style:left="{focal.x}%"
			style:top="{focal.y}%"
			aria-label={m.wishlist_appearance_background_focal_value({
				x: String(focal.x),
				y: String(focal.y),
			})}
			aria-roledescription={m.wishlist_appearance_background_focal_role()}
			aria-describedby={describedBy}
			{disabled}
			data-testid="wishlist-background-focal-handle"
			onkeydown={handleKeyDown}
		></button>
	</div>
</div>
