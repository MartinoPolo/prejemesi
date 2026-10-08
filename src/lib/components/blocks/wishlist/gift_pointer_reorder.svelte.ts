import { tick } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import type { GiftReorderPlacement } from '$lib/modules/gifts/gift_grouped_reorder.js';
import { copyComputedCustomProperties } from './copy_computed_custom_properties.js';

/** Grouped reorder: gift items, section headers and empty-group drop zones carry this key. */
export const GIFT_REORDER_GROUP_ATTRIBUTE = 'data-gift-reorder-group';
/** Vertical pointer travel toward another group, since the last switch, before it is entered. */
const GROUP_SWITCH_MINIMUM_TRAVEL = 12;

export interface GiftGroupedPointerReorderOptions {
	isActive: () => boolean;
	onPreviewPlacement: (placement: GiftReorderPlacement) => void;
	onCommitPlacement: (placement: GiftReorderPlacement) => void;
	onCancelPlacement: () => void;
}

export interface GiftPointerReorderOptions {
	getItemElements: () => HTMLElement[];
	getItemIds: () => string[];
	onPreviewOrder: (orderedIds: string[]) => void;
	onCommitOrder: (orderedIds: string[]) => void;
	onCancelOrder: (orderedIds: string[]) => void;
	/** Every element carrying GIFT_REORDER_GROUP_ATTRIBUTE, in display order. */
	getGroupTargetElements?: () => HTMLElement[];
	grouped?: GiftGroupedPointerReorderOptions;
}

interface Point {
	x: number;
	y: number;
}

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * Page-space layout box from offsets, which ignore the FLIP transforms the collection motion
 * applies while neighbours animate into their new places.
 */
function layoutBox(element: HTMLElement): Box {
	const parent = element.offsetParent;
	let originX = 0;
	let originY = 0;
	if (parent instanceof HTMLElement && parent !== document.body) {
		const parentRect = parent.getBoundingClientRect();
		originX = parentRect.left + window.scrollX + parent.clientLeft;
		originY = parentRect.top + window.scrollY + parent.clientTop;
	}
	const left = originX + element.offsetLeft;
	const top = originY + element.offsetTop;
	return { left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight };
}

function groupKeyOf(element: HTMLElement): string | null {
	return element.getAttribute(GIFT_REORDER_GROUP_ATTRIBUTE);
}

function samePlacement(first: GiftReorderPlacement, second: GiftReorderPlacement): boolean {
	return first.groupKey === second.groupKey && first.index === second.index;
}

function pixelValue(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function detachedSubgridRows(element: HTMLElement): string | null {
	const elementStyle = getComputedStyle(element);
	if (!elementStyle.gridTemplateRows.includes('subgrid')) {
		return null;
	}

	const parent = element.parentElement;
	if (parent === null) {
		return null;
	}
	const spanMatch = `${elementStyle.gridRowStart} ${elementStyle.gridRowEnd}`.match(
		/span\s+(\d+)/,
	);
	const rowSpan = spanMatch === null ? 0 : Number.parseInt(spanMatch[1]!, 10);
	const parentStyle = getComputedStyle(parent);
	const parentRows = Array.from(
		parentStyle.gridTemplateRows.matchAll(/(-?\d*\.?\d+)px/g),
		(match) => Number.parseFloat(match[1]!),
	);
	if (rowSpan < 1 || parentRows.length < rowSpan) {
		return null;
	}

	const parentGap = pixelValue(parentStyle.rowGap);
	const elementGap = pixelValue(elementStyle.rowGap);
	const parentRect = parent.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	const contentTop =
		parentRect.top +
		pixelValue(parentStyle.borderTopWidth) +
		pixelValue(parentStyle.paddingTop);
	let precedingTrackSize = 0;
	let closestStart = -1;
	let closestDifference = Number.POSITIVE_INFINITY;

	for (let start = 0; start <= parentRows.length - rowSpan; start += 1) {
		const rows = parentRows.slice(start, start + rowSpan);
		const candidateTop = contentTop + precedingTrackSize + start * parentGap;
		const candidateHeight =
			rows.reduce((total, row) => total + row, 0) + (rowSpan - 1) * parentGap;
		const difference =
			Math.abs(candidateTop - elementRect.top) +
			Math.abs(candidateHeight - elementRect.height);
		if (difference < closestDifference) {
			closestStart = start;
			closestDifference = difference;
		}
		precedingTrackSize += parentRows[start]!;
	}

	if (closestStart < 0 || closestDifference > 2) {
		return null;
	}

	const gapDifference = parentGap - elementGap;
	return parentRows
		.slice(closestStart, closestStart + rowSpan)
		.map((row, index) => {
			const adjacentGapShare =
				index === 0 || index === rowSpan - 1 ? gapDifference / 2 : gapDifference;
			return `${Math.max(0, row + adjacentGapShare)}px`;
		})
		.join(' ');
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
	let groupedDrag = false;
	let initialPlacement: GiftReorderPlacement | null = null;
	let currentPlacement: GiftReorderPlacement | null = null;
	let lastGroupSwitchPageY = 0;

	function groupTargetElements(): HTMLElement[] {
		return options.getGroupTargetElements?.() ?? [];
	}

	function isGiftItem(element: HTMLElement): boolean {
		return element.hasAttribute('data-gift-item');
	}

	function placementOf(giftId: string): GiftReorderPlacement | null {
		const items = groupTargetElements().filter(isGiftItem);
		const source = items.find((element) => element.dataset.giftId === giftId);
		const groupKey = source === undefined ? null : groupKeyOf(source);
		if (groupKey === null) {
			return null;
		}
		const index = items
			.filter((element) => groupKeyOf(element) === groupKey)
			.findIndex((element) => element.dataset.giftId === giftId);
		return { giftId, groupKey, index };
	}

	/**
	 * The group under the pointer wins, but only when the pointer travelled toward it since the
	 * last group switch: a layout shift under a resting pointer must not bounce the gift between
	 * groups. Within the group the gift lands after every other gift that precedes the pointer in
	 * reading order.
	 */
	function groupedPlacementAt(clientX: number, clientY: number): GiftReorderPlacement | null {
		if (currentPlacement === null) {
			return null;
		}
		const { giftId } = currentPlacement;
		const pageX = clientX + window.scrollX;
		const pageY = clientY + window.scrollY;
		const targets = groupTargetElements();
		const groupBoxes: Partial<Record<string, Box>> = {};
		for (const element of targets) {
			const key = groupKeyOf(element);
			if (key === null) {
				continue;
			}
			const box = layoutBox(element);
			const existing = groupBoxes[key];
			groupBoxes[key] =
				existing === undefined
					? box
					: {
							left: Math.min(existing.left, box.left),
							top: Math.min(existing.top, box.top),
							right: Math.max(existing.right, box.right),
							bottom: Math.max(existing.bottom, box.bottom),
						};
		}
		const groupOrder = Object.keys(groupBoxes);
		let groupKey = currentPlacement.groupKey;
		const hoveredGroupKey = groupOrder.find((key) => {
			const box = groupBoxes[key]!;
			return (
				pageX >= box.left && pageX <= box.right && pageY >= box.top && pageY <= box.bottom
			);
		});
		if (hoveredGroupKey !== undefined && hoveredGroupKey !== groupKey) {
			const groupDirection = Math.sign(
				groupOrder.indexOf(hoveredGroupKey) - groupOrder.indexOf(groupKey),
			);
			if (groupDirection * (pageY - lastGroupSwitchPageY) >= GROUP_SWITCH_MINIMUM_TRAVEL) {
				groupKey = hoveredGroupKey;
			}
		}

		const groupBox = groupBoxes[groupKey];
		const memberBoxes = targets
			.filter(
				(element) =>
					isGiftItem(element) &&
					groupKeyOf(element) === groupKey &&
					element.dataset.giftId !== giftId,
			)
			.map(layoutBox);
		const index = memberBoxes.filter((box) => {
			if (pageY < box.top) {
				return false;
			}
			if (pageY > box.bottom) {
				return true;
			}
			const multiColumn =
				groupBox !== undefined &&
				box.right - box.left < (groupBox.right - groupBox.left) * 0.75;
			return multiColumn
				? pageX > (box.left + box.right) / 2
				: pageY > (box.top + box.bottom) / 2;
		}).length;
		return { giftId, groupKey, index };
	}

	function adoptSourceElement(element: HTMLElement) {
		if (sourceElement === element) {
			return;
		}
		cleanSourceElement();
		sourceElement = element;
		sourceVisibility = element.style.visibility;
		element.setAttribute('data-gift-motion-dragging', '');
		element.style.visibility = 'hidden';
	}

	/** The dragged card re-renders with its live group badge; mirror it into the overlay. */
	async function refreshOverlayAfterRender() {
		await tick();
		const giftId = draggedGiftId.current;
		if (activePointerId === null || overlayElement === null || giftId === null) {
			return;
		}
		const element = options
			.getItemElements()
			.find((candidate) => candidate.dataset.giftId === giftId);
		if (element === undefined) {
			return;
		}
		adoptSourceElement(element);
		overlayElement.replaceChildren(
			...Array.from(element.childNodes, (node) => node.cloneNode(true)),
		);
		overlayElement.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
		overlayElement.style.height = `${element.offsetHeight}px`;
	}

	function previewGroupedMove(clientX: number, clientY: number) {
		const placement = groupedPlacementAt(clientX, clientY);
		if (
			placement === null ||
			currentPlacement === null ||
			samePlacement(placement, currentPlacement)
		) {
			return;
		}
		if (placement.groupKey !== currentPlacement.groupKey) {
			lastGroupSwitchPageY = clientY + window.scrollY;
		}
		currentPlacement = placement;
		options.grouped?.onPreviewPlacement(placement);
		void refreshOverlayAfterRender();
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
		copyComputedCustomProperties(element, clone);
		const materializedRows = detachedSubgridRows(element);
		if (materializedRows !== null) {
			// A detached subgrid loses the shared card tracks, so preserve their resolved geometry.
			clone.style.gridTemplateRows = materializedRows;
		}
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
			boxShadow: 'var(--elevation-lifted)',
		});
		document.body.append(clone);
		overlayElement = clone;
		moveOverlay(event.clientX, event.clientY);
	}

	function previewMove(targetIndex: number) {
		if (targetIndex === currentIndex || targetIndex < 0 || targetIndex >= currentOrder.length) {
			return;
		}
		const [movedId] = currentOrder.splice(currentIndex, 1);
		if (movedId === undefined) {
			return;
		}
		currentOrder.splice(targetIndex, 0, movedId);
		currentIndex = targetIndex;
		dragOverGiftId.current = currentOrder[targetIndex] ?? null;
		options.onPreviewOrder([...currentOrder]);
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		event.preventDefault();
		moveOverlay(event.clientX, event.clientY);
		if (groupedDrag) {
			previewGroupedMove(event.clientX, event.clientY);
			return;
		}
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

	function cleanSourceElement() {
		if (sourceElement !== null) {
			sourceElement.style.visibility = sourceVisibility;
			sourceElement.removeAttribute('data-gift-motion-dragging');
		}
		sourceElement = null;
		sourceVisibility = '';
	}

	function cleanVisualState() {
		overlayElement?.remove();
		overlayElement = null;
		cleanSourceElement();
	}

	function finishGrouped(commit: boolean) {
		const finalPlacement = currentPlacement;
		const startPlacement = initialPlacement;
		groupedDrag = false;
		initialPlacement = null;
		currentPlacement = null;
		if (
			commit &&
			finalPlacement !== null &&
			startPlacement !== null &&
			!samePlacement(finalPlacement, startPlacement)
		) {
			options.grouped?.onCommitPlacement(finalPlacement);
		} else {
			options.grouped?.onCancelPlacement();
		}
	}

	function finish(commit: boolean) {
		if (activePointerId === null) {
			return;
		}
		removeListeners();
		const finalOrder = [...currentOrder];
		const rollbackOrder = [...initialOrder];
		activePointerId = null;
		const giftId = draggedGiftId.current;
		if (groupedDrag && giftId !== null) {
			const renderedSource = options
				.getItemElements()
				.find((candidate) => candidate.dataset.giftId === giftId);
			if (renderedSource !== undefined) {
				adoptSourceElement(renderedSource);
			}
		}
		if (sourceElement !== null && overlayElement !== null) {
			sourceElement.dispatchEvent(
				new CustomEvent('gift-motion-drop', {
					bubbles: true,
					detail: {
						giftId: draggedGiftId.current,
						rectangle: overlayElement.getBoundingClientRect(),
					},
				}),
			);
		}
		cleanVisualState();
		draggedGiftId.current = null;
		dragOverGiftId.current = null;
		initialOrder = [];
		currentOrder = [];
		currentIndex = -1;
		stableHitTestCenters = [];
		if (groupedDrag) {
			finishGrouped(commit);
		} else if (commit) {
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
		adoptSourceElement(element);
		const groupedPlacement = options.grouped?.isActive() === true ? placementOf(giftId) : null;
		groupedDrag = groupedPlacement !== null;
		initialPlacement = groupedPlacement;
		currentPlacement = groupedPlacement;
		lastGroupSwitchPageY = event.clientY + window.scrollY;
		if (groupedDrag) {
			void refreshOverlayAfterRender();
		}

		window.addEventListener('pointermove', handlePointerMove, { passive: false });
		window.addEventListener('pointerup', handlePointerUp);
		window.addEventListener('pointercancel', handlePointerCancel);
		window.addEventListener('keydown', handleKeydown);
	}

	function move(index: number, direction: -1 | 1): boolean {
		if (activePointerId !== null) {
			return false;
		}
		const itemIds = options.getItemIds();
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= itemIds.length) {
			return false;
		}
		const [movedId] = itemIds.splice(index, 1);
		if (movedId === undefined) {
			return false;
		}
		itemIds.splice(targetIndex, 0, movedId);
		options.onPreviewOrder([...itemIds]);
		options.onCommitOrder([...itemIds]);
		return true;
	}

	function cancel() {
		finish(false);
	}

	function destroy() {
		finish(false);
	}

	return { draggedGiftId, dragOverGiftId, start, move, cancel, destroy };
}
