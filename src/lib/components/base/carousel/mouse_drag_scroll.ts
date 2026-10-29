import { prefersReducedMotion } from 'svelte/motion';
import { resolveReleaseGlide, type PointerSample } from './scroll_row.js';

const DRAG_THRESHOLD = 6;
const SAMPLE_HISTORY = 12;
const DRAGGING_ATTRIBUTE = 'data-dragging';

/**
 * Click-and-drag scrolling for mouse pointers on a native horizontal scroller. Touch and pen keep
 * the browser's own panning, which runs on the compositor; a mouse has no native drag-to-scroll.
 * Returns a cleanup function.
 */
export function attachMouseDragScroll(viewport: HTMLElement): () => void {
	let pointerId: number | null = null;
	let startX = 0;
	let startScrollLeft = 0;
	let dragging = false;
	let suppressClick = false;
	let samples: PointerSample[] = [];

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType !== 'mouse' || event.button !== 0) {
			return;
		}
		pointerId = event.pointerId;
		startX = event.clientX;
		startScrollLeft = viewport.scrollLeft;
		dragging = false;
		samples = [{ x: event.clientX, time: event.timeStamp }];
	}

	function onPointerMove(event: PointerEvent) {
		if (event.pointerId !== pointerId) {
			return;
		}
		const deltaX = event.clientX - startX;
		if (!dragging) {
			if (Math.abs(deltaX) < DRAG_THRESHOLD) {
				return;
			}
			dragging = true;
			viewport.setPointerCapture(event.pointerId);
			viewport.setAttribute(DRAGGING_ATTRIBUTE, '');
		}
		viewport.scrollLeft = startScrollLeft - deltaX;
		samples.push({ x: event.clientX, time: event.timeStamp });
		if (samples.length > SAMPLE_HISTORY) {
			samples.shift();
		}
	}

	function endDrag(event: PointerEvent, glide: boolean) {
		if (event.pointerId !== pointerId) {
			return;
		}
		pointerId = null;
		if (!dragging) {
			return;
		}
		dragging = false;
		viewport.removeAttribute(DRAGGING_ATTRIBUTE);
		if (viewport.hasPointerCapture(event.pointerId)) {
			viewport.releasePointerCapture(event.pointerId);
		}
		// The click that follows a drag's pointerup would otherwise open the card under the pointer.
		suppressClick = true;
		setTimeout(() => {
			suppressClick = false;
		});
		const glideDistance =
			glide && !prefersReducedMotion.current
				? resolveReleaseGlide(samples, event.timeStamp)
				: 0;
		if (glideDistance !== 0) {
			viewport.scrollBy({ left: glideDistance, behavior: 'smooth' });
		}
	}

	const onPointerUp = (event: PointerEvent) => endDrag(event, true);
	const onPointerCancel = (event: PointerEvent) => endDrag(event, false);

	function onClick(event: MouseEvent) {
		if (suppressClick) {
			event.preventDefault();
			event.stopPropagation();
			suppressClick = false;
		}
	}

	// Native link and image dragging would take over the gesture and cancel the pointer stream.
	function onDragStart(event: DragEvent) {
		event.preventDefault();
	}

	viewport.addEventListener('pointerdown', onPointerDown);
	viewport.addEventListener('pointermove', onPointerMove);
	viewport.addEventListener('pointerup', onPointerUp);
	viewport.addEventListener('pointercancel', onPointerCancel);
	viewport.addEventListener('click', onClick, { capture: true });
	viewport.addEventListener('dragstart', onDragStart);
	return () => {
		viewport.removeEventListener('pointerdown', onPointerDown);
		viewport.removeEventListener('pointermove', onPointerMove);
		viewport.removeEventListener('pointerup', onPointerUp);
		viewport.removeEventListener('pointercancel', onPointerCancel);
		viewport.removeEventListener('click', onClick, { capture: true });
		viewport.removeEventListener('dragstart', onDragStart);
	};
}
