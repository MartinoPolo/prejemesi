import { StateRaw } from '$lib/reactivity/state.svelte.js';

/**
 * Pointer-driven gift reordering shared by the card grid and list layouts.
 *
 * Replaces native HTML5 drag-and-drop (which never fires on touch) with pointer events, so mouse,
 * touch, and pen all run through one code path. A drag is started from a gift's grip handle
 * (`start`); the controller then tracks the pointer on the window and hit-tests the sibling card
 * elements to compute the live insertion index. On release it invokes `onReorder(from, to)`, which
 * the page wires to the existing optimistic-override + persistence path.
 *
 * `getItemElements` returns the wrapper elements in DOM (visual) order — one per rendered gift,
 * index-aligned with the gift array. The controller stays layout-agnostic by hit-testing element
 * rects: nearest-center works for both the 2D grid and the 1D list.
 */
export interface GiftPointerReorderOptions {
	getItemElements: () => HTMLElement[];
	onReorder: (fromIndex: number, toIndex: number) => void;
}

export type GiftPointerReorderController = ReturnType<typeof createGiftPointerReorderController>;

export function createGiftPointerReorderController(options: GiftPointerReorderOptions) {
	// The index being dragged (source) and the index the pointer currently hovers (target). Both
	// drive the visual lift/placeholder affordance in the wrapper; null when no drag is active.
	const draggedIndex = new StateRaw<number | null>(null);
	const dragOverIndex = new StateRaw<number | null>(null);

	let activePointerId: number | null = null;

	function nearestIndex(clientX: number, clientY: number): number | null {
		const elements = options.getItemElements();
		let bestIndex: number | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (let index = 0; index < elements.length; index += 1) {
			const rect = elements[index]!.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;
			const distance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		}

		return bestIndex;
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		// Suppress touch scrolling / text selection while a reorder drag is in progress.
		event.preventDefault();
		dragOverIndex.current = nearestIndex(event.clientX, event.clientY);
	}

	function finish(commit: boolean) {
		const from = draggedIndex.current;
		const to = dragOverIndex.current;

		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerup', handlePointerUp);
		window.removeEventListener('pointercancel', handlePointerCancel);

		activePointerId = null;
		draggedIndex.current = null;
		dragOverIndex.current = null;

		if (commit && from !== null && to !== null && from !== to) {
			options.onReorder(from, to);
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		finish(true);
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		finish(false);
	}

	/** Begin a drag from a grip handle. `event` is the grip's pointerdown. */
	function start(event: PointerEvent, index: number) {
		// Ignore secondary mouse buttons and re-entrant starts.
		if (activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
			return;
		}
		event.preventDefault();
		activePointerId = event.pointerId;
		draggedIndex.current = index;
		dragOverIndex.current = index;

		// Listen on the window (passive:false so preventDefault can stop touch scroll) so the drag
		// keeps tracking even when the pointer leaves the card it started on.
		window.addEventListener('pointermove', handlePointerMove, { passive: false });
		window.addEventListener('pointerup', handlePointerUp);
		window.addEventListener('pointercancel', handlePointerCancel);
	}

	/** Tear down any in-flight listeners (call from the host component's effect cleanup). */
	function destroy() {
		if (activePointerId !== null) {
			finish(false);
		}
	}

	return {
		draggedIndex,
		dragOverIndex,
		start,
		destroy,
	};
}
