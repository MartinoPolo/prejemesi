import { SvelteMap } from 'svelte/reactivity';
import type { Attachment } from 'svelte/attachments';
import {
	clamp01,
	cropRectToFocalZoom,
	cropRectsClose,
	panCropRect,
	zoomCropRect,
	type CropWindowPoint,
	type ImageCropRect,
} from '$lib/modules/images/index.js';
import {
	KEYBOARD_PAN_FRACTION,
	KEYBOARD_PAN_FRACTION_LARGE,
	type StageBox,
} from './crop_stage_geometry.js';
import { CROP_ZOOM_STEP } from './crop_zoom_control.js';

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const INTERACTION_LINGER_MS = 700;

interface CropPanInteractionOptions {
	/** The window shown right now; every edit starts from it. */
	shownRect: () => ImageCropRect;
	/** Normalized aspect the window keeps while zooming. */
	normalizedAspect: () => number;
	/** Where the window sits inside the attached element, in CSS pixels. */
	windowBox: () => StageBox | null;
	/** Ignores every edit, e.g. before the photo is measured. */
	disabled: () => boolean;
	/** The window the `0` key restores. */
	recenteredRect: () => ImageCropRect;
	/** Receives user edits that change the shown window. */
	onchange: (rect: ImageCropRect) => void;
}

/**
 * Pan and zoom of a crop window from one focusable element: pointer drag pans,
 * wheel and two-finger pinch zoom around the pointer, arrows pan, `+`/`−` zoom
 * and `0` recenters. Wire it with `{@attach interaction.attach}`.
 */
export class CropPanInteraction {
	/** True while pointers are down and briefly after the last edit. */
	interacting = $state(false);

	#options: CropPanInteractionOptions;
	// Pointer bookkeeping, read only inside handlers apart from `dragging`.
	#activePointers = new SvelteMap<number, { x: number; y: number }>();
	#pinchDistance: number | null = null;
	#lingerTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(options: CropPanInteractionOptions) {
		this.#options = options;
	}

	/** True while at least one pointer drags or pinches. */
	get dragging(): boolean {
		return this.#activePointers.size > 0;
	}

	/** Reports a user edit unless it is disabled or a clamped no-op; returns whether it reported. */
	emit(rect: ImageCropRect): boolean {
		// A clamped no-op (e.g. panning against an edge) must not promote or dirty the form.
		if (this.#options.disabled() || cropRectsClose(rect, this.#options.shownRect())) {
			return false;
		}
		this.#options.onchange(rect);
		return true;
	}

	/** Zooms around a window-relative anchor, the window centre by default. */
	zoomTo(nextZoom: number, anchor?: CropWindowPoint): boolean {
		return this.emit(
			zoomCropRect(
				this.#options.shownRect(),
				this.#options.normalizedAspect(),
				nextZoom,
				anchor,
			),
		);
	}

	attach: Attachment<HTMLElement> = (element) => {
		const handlePointerDown = (event: PointerEvent) => this.#pointerDown(element, event);
		const handlePointerMove = (event: PointerEvent) => this.#pointerMove(element, event);
		const handlePointerEnd = (event: PointerEvent) => this.#pointerEnd(event);
		const handleWheel = (event: WheelEvent) => this.#wheel(element, event);
		const handleKeydown = (event: KeyboardEvent) => this.#keydown(event);
		element.addEventListener('pointerdown', handlePointerDown);
		element.addEventListener('pointermove', handlePointerMove);
		element.addEventListener('pointerup', handlePointerEnd);
		element.addEventListener('pointercancel', handlePointerEnd);
		element.addEventListener('lostpointercapture', handlePointerEnd);
		// Non-passive so `preventDefault()` keeps the page from scrolling while zooming.
		element.addEventListener('wheel', handleWheel, { passive: false });
		element.addEventListener('keydown', handleKeydown);
		return () => {
			element.removeEventListener('pointerdown', handlePointerDown);
			element.removeEventListener('pointermove', handlePointerMove);
			element.removeEventListener('pointerup', handlePointerEnd);
			element.removeEventListener('pointercancel', handlePointerEnd);
			element.removeEventListener('lostpointercapture', handlePointerEnd);
			element.removeEventListener('wheel', handleWheel);
			element.removeEventListener('keydown', handleKeydown);
			clearTimeout(this.#lingerTimer);
			this.#activePointers.clear();
			this.#pinchDistance = null;
			this.interacting = false;
		};
	};

	#zoom(): number {
		return cropRectToFocalZoom(this.#options.shownRect()).zoom;
	}

	#markInteracting(): void {
		this.interacting = true;
		clearTimeout(this.#lingerTimer);
		this.#lingerTimer = setTimeout(() => {
			if (this.#activePointers.size === 0) {
				this.interacting = false;
			}
		}, INTERACTION_LINGER_MS);
	}

	#panByPixels(deltaX: number, deltaY: number): void {
		const windowBox = this.#options.windowBox();
		if (windowBox === null) {
			return;
		}
		// The photo follows the pointer, so the crop moves the opposite way.
		const rect = this.#options.shownRect();
		this.emit(
			panCropRect(
				rect,
				(-deltaX * rect.w) / windowBox.width,
				(-deltaY * rect.h) / windowBox.height,
			),
		);
	}

	/** Window-relative position of a client point, clamped to the window. */
	#windowPointAt(
		element: HTMLElement,
		clientX: number,
		clientY: number,
	): CropWindowPoint | undefined {
		const windowBox = this.#options.windowBox();
		if (windowBox === null) {
			return undefined;
		}
		const bounds = element.getBoundingClientRect();
		return {
			x: clamp01((clientX - bounds.left - windowBox.left) / windowBox.width),
			y: clamp01((clientY - bounds.top - windowBox.top) / windowBox.height),
		};
	}

	#pointerDown(element: HTMLElement, event: PointerEvent): void {
		if (this.#options.disabled() || event.button !== 0) {
			return;
		}
		event.preventDefault();
		element.focus({ preventScroll: true });
		element.setPointerCapture?.(event.pointerId);
		this.#activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.#pinchDistance = null;
		this.interacting = true;
	}

	#pointerMove(element: HTMLElement, event: PointerEvent): void {
		const previous = this.#activePointers.get(event.pointerId);
		if (previous === undefined) {
			return;
		}
		this.#activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (this.#activePointers.size === 1) {
			this.#panByPixels(event.clientX - previous.x, event.clientY - previous.y);
			return;
		}
		const [first, second] = [...this.#activePointers.values()];
		const distance = Math.hypot(first.x - second.x, first.y - second.y);
		if (this.#pinchDistance !== null && this.#pinchDistance > 0) {
			const midpoint = this.#windowPointAt(
				element,
				(first.x + second.x) / 2,
				(first.y + second.y) / 2,
			);
			this.zoomTo((this.#zoom() * distance) / this.#pinchDistance, midpoint);
		}
		this.#pinchDistance = distance;
	}

	#pointerEnd(event: PointerEvent): void {
		this.#activePointers.delete(event.pointerId);
		this.#pinchDistance = null;
		if (this.#activePointers.size === 0) {
			this.#markInteracting();
		}
	}

	#wheel(element: HTMLElement, event: WheelEvent): void {
		if (this.#options.disabled()) {
			return;
		}
		const zoomed = this.zoomTo(
			this.#zoom() * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY),
			this.#windowPointAt(element, event.clientX, event.clientY),
		);
		// A zoom clamped at its limit lets the wheel scroll the dialog instead; a trackpad pinch
		// (ctrl + wheel) never zooms the page.
		if (zoomed || event.ctrlKey) {
			event.preventDefault();
		}
		if (zoomed) {
			this.#markInteracting();
		}
	}

	#keydown(event: KeyboardEvent): void {
		// Leave browser and OS shortcuts such as Ctrl/Cmd + "+" to the browser.
		if (this.#options.disabled() || event.ctrlKey || event.metaKey || event.altKey) {
			return;
		}
		const fraction = event.shiftKey ? KEYBOARD_PAN_FRACTION_LARGE : KEYBOARD_PAN_FRACTION;
		const rect = this.#options.shownRect();
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-rect.w * fraction, 0],
			ArrowRight: [rect.w * fraction, 0],
			ArrowUp: [0, -rect.h * fraction],
			ArrowDown: [0, rect.h * fraction],
		};
		const move = moves[event.key];
		if (move !== undefined) {
			this.emit(panCropRect(rect, move[0], move[1]));
		} else if (event.key === '+' || event.key === '=') {
			this.zoomTo(this.#zoom() + CROP_ZOOM_STEP);
		} else if (event.key === '-') {
			this.zoomTo(this.#zoom() - CROP_ZOOM_STEP);
		} else if (event.key === '0') {
			this.emit(this.#options.recenteredRect());
		} else {
			return;
		}
		event.preventDefault();
	}
}
