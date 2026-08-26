import { StateRaw } from '$lib/reactivity/state.svelte.js';

export interface GiftPointerReorderOptions {
	getItemElements: () => HTMLElement[];
	getItemIds: () => string[];
	onPreviewOrder: (orderedIds: string[]) => void;
	onCommitOrder: (orderedIds: string[]) => void;
	onCancelOrder: (orderedIds: string[]) => void;
}

export type GiftPointerReorderController = ReturnType<typeof createGiftPointerReorderController>;

interface ItemPosition {
	left: number;
	top: number;
}

interface Point {
	x: number;
	y: number;
}

export function createGiftPointerReorderController(options: GiftPointerReorderOptions) {
	const draggedGiftId = new StateRaw<string | null>(null);
	const dragOverGiftId = new StateRaw<string | null>(null);

	let activePointerId: number | null = null;
	let initialOrder: string[] = [];
	let currentOrder: string[] = [];
	let currentIndex = -1;
	let overlayElement: HTMLElement | null = null;
	let sourceElement: HTMLElement | null = null;
	let sourceVisibility = '';
	let pointerOffsetX = 0;
	let pointerOffsetY = 0;
	let stableHitTestCenters: Point[] = [];
	const runningAnimations = new WeakMap<HTMLElement, Animation>();

	function prefersReducedMotion(): boolean {
		return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	}

	function capturePositions(): Map<string, ItemPosition> {
		// These FLIP snapshots are local and non-reactive; SvelteMap would add no behavior.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const positions = new Map<string, ItemPosition>();
		for (const element of options.getItemElements()) {
			const id = element.dataset.giftId;
			if (id === undefined) {
				continue;
			}
			const rect = element.getBoundingClientRect();
			positions.set(id, { left: rect.left, top: rect.top });
		}
		return positions;
	}

	function animateFrom(previousPositions: Map<string, ItemPosition>) {
		if (prefersReducedMotion()) {
			return;
		}
		requestAnimationFrame(() => {
			for (const element of options.getItemElements()) {
				const id = element.dataset.giftId;
				const previousPosition = id === undefined ? undefined : previousPositions.get(id);
				if (previousPosition === undefined || id === draggedGiftId.current) {
					continue;
				}
				const rect = element.getBoundingClientRect();
				const translateX = previousPosition.left - rect.left;
				const translateY = previousPosition.top - rect.top;
				if (translateX === 0 && translateY === 0) {
					continue;
				}
				runningAnimations.get(element)?.cancel();
				if (typeof element.animate !== 'function') {
					continue;
				}
				const animation = element.animate(
					[
						{ transform: `translate(${translateX}px, ${translateY}px)` },
						{ transform: 'translate(0, 0)' },
					],
					{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
				);
				runningAnimations.set(element, animation);
			}
		});
	}

	function captureHitTestCenters(elements: HTMLElement[]): Point[] {
		const scrollX = window.scrollX;
		const scrollY = window.scrollY;

		return elements.map((element) => {
			const rect = element.getBoundingClientRect();

			return {
				x: rect.left + scrollX + rect.width / 2,
				y: rect.top + scrollY + rect.height / 2,
			};
		});
	}

	function nearestIndex(clientX: number, clientY: number): number | null {
		let bestIndex: number | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		const pageX = clientX + window.scrollX;
		const pageY = clientY + window.scrollY;

		for (let index = 0; index < stableHitTestCenters.length; index += 1) {
			const center = stableHitTestCenters[index]!;
			const distance = (pageX - center.x) ** 2 + (pageY - center.y) ** 2;
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		}

		return bestIndex;
	}

	function moveOverlay(clientX: number, clientY: number) {
		if (overlayElement !== null) {
			overlayElement.style.transform = `translate3d(${clientX - pointerOffsetX}px, ${clientY - pointerOffsetY}px, 0)`;
		}
	}

	function createOverlay(element: HTMLElement, event: PointerEvent) {
		const rect = element.getBoundingClientRect();
		pointerOffsetX = event.clientX - rect.left;
		pointerOffsetY = event.clientY - rect.top;

		const clone = element.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
		clone.removeAttribute('id');
		clone.setAttribute('aria-hidden', 'true');
		clone.setAttribute('inert', '');
		clone.dataset.giftReorderOverlay = '';
		Object.assign(clone.style, {
			position: 'fixed',
			left: '0',
			top: '0',
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			margin: '0',
			boxSizing: 'border-box',
			pointerEvents: 'none',
			transition: 'none',
			zIndex: '100',
			opacity: '0.96',
			filter: 'drop-shadow(0 16px 18px rgb(0 0 0 / 0.22))',
		});
		document.body.append(clone);
		overlayElement = clone;
		moveOverlay(event.clientX, event.clientY);
	}

	function previewMove(targetIndex: number) {
		if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= currentOrder.length) {
			return;
		}
		const previousPositions = capturePositions();
		const [movedId] = currentOrder.splice(currentIndex, 1);
		if (movedId === undefined) {
			return;
		}
		currentOrder.splice(targetIndex, 0, movedId);
		currentIndex = targetIndex;
		dragOverGiftId.current = currentOrder[targetIndex] ?? null;
		options.onPreviewOrder([...currentOrder]);
		animateFrom(previousPositions);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		event.preventDefault();
		moveOverlay(event.clientX, event.clientY);
		const targetIndex = nearestIndex(event.clientX, event.clientY);
		if (targetIndex !== null) {
			previewMove(targetIndex);
		}
	}

	function removeListeners() {
		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerup', handlePointerUp);
		window.removeEventListener('pointercancel', handlePointerCancel);
		window.removeEventListener('keydown', handleKeydown);
	}

	function cleanVisualState() {
		overlayElement?.remove();
		overlayElement = null;
		if (sourceElement !== null) {
			sourceElement.style.visibility = sourceVisibility;
		}
		sourceElement = null;
		sourceVisibility = '';
	}

	function finish(commit: boolean) {
		if (activePointerId === null) {
			return;
		}
		removeListeners();
		const finalOrder = [...currentOrder];
		const rollbackOrder = [...initialOrder];
		activePointerId = null;
		cleanVisualState();
		draggedGiftId.current = null;
		dragOverGiftId.current = null;
		initialOrder = [];
		currentOrder = [];
		currentIndex = -1;
		stableHitTestCenters = [];
		if (commit) {
			if (finalOrder.some((id, index) => id !== rollbackOrder[index])) {
				options.onCommitOrder(finalOrder);
			}
		} else {
			options.onCancelOrder(rollbackOrder);
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.pointerId === activePointerId) {
			finish(true);
		}
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId === activePointerId) {
			finish(false);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') {
			return;
		}
		event.preventDefault();
		finish(false);
	}

	function start(event: PointerEvent, index: number) {
		if (activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
			return;
		}
		const itemIds = options.getItemIds();
		const itemElements = options.getItemElements();
		const element = itemElements[index];
		const giftId = itemIds[index];
		if (element === undefined || giftId === undefined) {
			return;
		}

		event.preventDefault();
		activePointerId = event.pointerId;
		initialOrder = [...itemIds];
		currentOrder = [...itemIds];
		currentIndex = index;
		stableHitTestCenters = captureHitTestCenters(itemElements);
		draggedGiftId.current = giftId;
		dragOverGiftId.current = giftId;
		createOverlay(element, event);
		sourceElement = element;
		sourceVisibility = element.style.visibility;
		element.style.visibility = 'hidden';

		window.addEventListener('pointermove', handlePointerMove, { passive: false });
		window.addEventListener('pointerup', handlePointerUp);
		window.addEventListener('pointercancel', handlePointerCancel);
		window.addEventListener('keydown', handleKeydown);
	}

	function move(index: number, direction: -1 | 1) {
		if (activePointerId !== null) {
			return;
		}
		const itemIds = options.getItemIds();
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= itemIds.length) {
			return;
		}
		const previousPositions = capturePositions();
		const [movedId] = itemIds.splice(index, 1);
		if (movedId === undefined) {
			return;
		}
		itemIds.splice(targetIndex, 0, movedId);
		options.onPreviewOrder([...itemIds]);
		animateFrom(previousPositions);
		options.onCommitOrder([...itemIds]);
	}

	function cancel() {
		finish(false);
	}

	function destroy() {
		finish(false);
	}

	return { draggedGiftId, dragOverGiftId, start, move, cancel, destroy };
}
