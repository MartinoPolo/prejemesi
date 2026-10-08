import { tick } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import type { GiftReorderPlacement } from '$lib/modules/gifts/gift_grouped_reorder.js';
import { copyComputedCustomProperties } from './copy_computed_custom_properties.js';
import {
	autoScrollStep,
	boxCenter,
	closestGroupSlot,
	closestSlotIndex,
	draggedCardCenter,
	isPastCell,
	unionBox,
	type Box,
	type GroupSlotHit,
	type Point,
	type SlotGap,
} from './gift_reorder_hit_testing.js';

/** Grouped reorder: gift items, section headers and empty-group drop zones carry this key. */
export const GIFT_REORDER_GROUP_ATTRIBUTE = 'data-gift-reorder-group';
/** Marks the drop zone an empty group shows instead of gifts. */
export const GIFT_REORDER_DROP_ZONE_ATTRIBUTE = 'data-gift-reorder-drop-zone';
/** Marks the hidden source of an active pointer drag, which the overlay stands in for. */
export const GIFT_MOTION_DRAGGING_ATTRIBUTE = 'data-gift-motion-dragging';
/** Vertical dragged-card travel toward another group, since the last switch, before it enters. */
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

/**
 * Grouped slot geometry, measured after a group change has rendered and kept while the gift
 * permutes within a group: the cells stay put, only the gifts in them move.
 */
interface GroupedGeometry {
	/** Each group's rendered slots in display order: its gift cells, or its drop zone while empty. */
	slotBoxes: ReadonlyMap<string, readonly Box[]>;
	slotCenters: ReadonlyMap<string, readonly Point[]>;
	/** Groups showing a drop zone, which a gift enters as their only member. */
	emptyGroups: ReadonlySet<string>;
	/** Each group's right edge, which tells whether a cell has another column beside it. */
	regionRights: ReadonlyMap<string, number>;
	gap: SlotGap;
}

interface GroupMeasurement {
	key: string;
	/** Header, gifts and drop zone together. */
	region: Box;
	memberBoxes: Box[];
	dropZoneBoxes: Box[];
}

/**
 * The element that scrolls the gifts: the app shell scrolls its content area, not the window.
 * Drag geometry lives in its scrolled content space, so auto-scroll never invalidates it.
 */
function scrollContainerOf(element: HTMLElement): HTMLElement {
	for (
		let ancestor = element.parentElement;
		ancestor !== null;
		ancestor = ancestor.parentElement
	) {
		const { overflowY } = getComputedStyle(ancestor);
		if (
			(overflowY === 'auto' || overflowY === 'scroll') &&
			ancestor.scrollHeight > ancestor.clientHeight
		) {
			return ancestor;
		}
	}
	return document.scrollingElement instanceof HTMLElement
		? document.scrollingElement
		: document.documentElement;
}

/**
 * Content-space layout box from offsets, which ignore the FLIP transforms the collection motion
 * applies while neighbours animate into their new places.
 */
function layoutBox(element: HTMLElement, scrollOffset: Point): Box {
	const parent = element.offsetParent;
	let originX = scrollOffset.x;
	let originY = scrollOffset.y;
	if (parent instanceof HTMLElement && parent !== document.body) {
		const parentRect = parent.getBoundingClientRect();
		originX += parentRect.left + parent.clientLeft;
		originY += parentRect.top + parent.clientTop;
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
	/** Kept per overlay render, since reading it on every move would force a layout. */
	let overlaySize = { width: 0, height: 0 };
	let sourceElement: HTMLElement | null = null;
	let sourceVisibility = '';
	let grabOffset: Point = { x: 0, y: 0 };
	let lastPointer: Point = { x: 0, y: 0 };
	let autoScrollFrame: number | null = null;
	let scrollContainer: HTMLElement = document.documentElement;
	let stableHitTestCenters: Point[] = [];
	let groupedDrag = false;
	let groupedGeometry: GroupedGeometry | null = null;
	let initialPlacement: GiftReorderPlacement | null = null;
	let currentPlacement: GiftReorderPlacement | null = null;
	let lastGroupSwitchY = 0;

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

	function slotGap(items: readonly HTMLElement[]): SlotGap {
		const parent = items[0]?.parentElement;
		if (parent == null) {
			return { column: 0, row: 0 };
		}
		const style = getComputedStyle(parent);
		return { column: pixelValue(style.columnGap), row: pixelValue(style.rowGap) };
	}

	function scrollOffset(): Point {
		return { x: scrollContainer.scrollLeft, y: scrollContainer.scrollTop };
	}

	function measureGroups() {
		const offset = scrollOffset();
		const measurements: GroupMeasurement[] = [];
		const items: HTMLElement[] = [];
		for (const element of groupTargetElements()) {
			const key = groupKeyOf(element);
			if (key === null) {
				continue;
			}
			const box = layoutBox(element, offset);
			let measurement = measurements.find((candidate) => candidate.key === key);
			if (measurement === undefined) {
				measurement = { key, region: box, memberBoxes: [], dropZoneBoxes: [] };
				measurements.push(measurement);
			}
			measurement.region = unionBox(measurement.region, box);
			if (isGiftItem(element)) {
				items.push(element);
				measurement.memberBoxes.push(box);
			} else if (element.hasAttribute(GIFT_REORDER_DROP_ZONE_ATTRIBUTE)) {
				measurement.dropZoneBoxes.push(box);
			}
		}
		return { measurements, gap: slotGap(items) };
	}

	function measureGroupedGeometry(): GroupedGeometry {
		const { measurements, gap } = measureGroups();
		const slotBoxes = measurements.map(
			({ key, memberBoxes, dropZoneBoxes }) =>
				[key, memberBoxes.length === 0 ? dropZoneBoxes : memberBoxes] as const,
		);
		return {
			slotBoxes: new SvelteMap(slotBoxes),
			slotCenters: new SvelteMap(
				slotBoxes.map(([key, boxes]) => [key, boxes.map(boxCenter)]),
			),
			emptyGroups: new SvelteSet(
				measurements
					.filter(({ memberBoxes }) => memberBoxes.length === 0)
					.map(({ key }) => key),
			),
			regionRights: new SvelteMap(measurements.map(({ key, region }) => [key, region.right])),
			gap,
		};
	}

	/** A gift entering another group lands before or after the closest of its cells. */
	function entrySlot(
		geometry: GroupedGeometry,
		center: Point,
		closest: GroupSlotHit,
	): GroupSlotHit {
		const cell = geometry.slotBoxes.get(closest.groupKey)?.[closest.index];
		if (cell === undefined || geometry.emptyGroups.has(closest.groupKey)) {
			return closest;
		}
		const regionRight = geometry.regionRights.get(closest.groupKey) ?? cell.right;
		const pastCell = isPastCell(center, cell, regionRight, geometry.gap);
		return { groupKey: closest.groupKey, index: closest.index + (pastCell ? 1 : 0) };
	}

	/**
	 * The closest rendered slot, a gift cell or an empty group's drop zone, picks the group: within
	 * the gift's own group it takes that cell's place, in another group it lands beside the cell.
	 * Another group wins only once the card travelled toward it since the last group switch, so a
	 * layout shift under a resting pointer never bounces the gift between groups.
	 */
	function groupSlotAt(
		geometry: GroupedGeometry,
		center: Point,
		placement: GiftReorderPlacement,
	): GroupSlotHit {
		const closest = closestGroupSlot(center, geometry.slotCenters);
		if (closest === null || closest.groupKey === placement.groupKey) {
			return closest ?? placement;
		}
		const groupOrder = [...geometry.slotCenters.keys()];
		const groupDirection = Math.sign(
			groupOrder.indexOf(closest.groupKey) - groupOrder.indexOf(placement.groupKey),
		);
		return groupDirection * (center.y - lastGroupSwitchY) >= GROUP_SWITCH_MINIMUM_TRAVEL
			? entrySlot(geometry, center, closest)
			: placement;
	}

	function groupedPlacementAt(center: Point): GiftReorderPlacement | null {
		if (currentPlacement === null) {
			return null;
		}
		groupedGeometry ??= measureGroupedGeometry();
		const { groupKey, index } = groupSlotAt(groupedGeometry, center, currentPlacement);
		return { giftId: currentPlacement.giftId, groupKey, index };
	}

	function adoptSourceElement(element: HTMLElement) {
		if (sourceElement === element) {
			return;
		}
		cleanSourceElement();
		sourceElement = element;
		sourceVisibility = element.style.visibility;
		element.setAttribute(GIFT_MOTION_DRAGGING_ATTRIBUTE, '');
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
		overlaySize = { width: overlaySize.width, height: element.offsetHeight };
		overlayElement.style.height = `${overlaySize.height}px`;
	}

	function previewGroupedMove(center: Point) {
		const placement = groupedPlacementAt(center);
		if (
			placement === null ||
			currentPlacement === null ||
			samePlacement(placement, currentPlacement)
		) {
			return;
		}
		if (placement.groupKey !== currentPlacement.groupKey) {
			lastGroupSwitchY = center.y;
			// Group sizes change once the move renders; measure again on the next hit test.
			groupedGeometry = null;
		}
		currentPlacement = placement;
		options.grouped?.onPreviewPlacement(placement);
		void refreshOverlayAfterRender();
	}

	function captureHitTestCenters(elements: HTMLElement[]): Point[] {
		const offset = scrollOffset();

		return elements.map((element) => {
			const rect = element.getBoundingClientRect();

			return {
				x: rect.left + offset.x + rect.width / 2,
				y: rect.top + offset.y + rect.height / 2,
			};
		});
	}

	/** Content-space center of the dragged card, which collision uses instead of the grab point. */
	function draggedContentCenter(): Point {
		const center = draggedCardCenter(lastPointer, grabOffset, overlaySize);
		const offset = scrollOffset();
		return { x: center.x + offset.x, y: center.y + offset.y };
	}

	function moveOverlay() {
		if (overlayElement !== null) {
			overlayElement.style.transform = `translate3d(${lastPointer.x - grabOffset.x}px, ${lastPointer.y - grabOffset.y}px, 0)`;
		}
	}

	function createOverlay(element: HTMLElement, event: PointerEvent) {
		const rect = element.getBoundingClientRect();
		grabOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
		lastPointer = { x: event.clientX, y: event.clientY };

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
		overlaySize = { width: rect.width, height: rect.height };
		moveOverlay();
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

	function previewAtDraggedCenter() {
		const center = draggedContentCenter();
		if (groupedDrag) {
			previewGroupedMove(center);
			return;
		}
		const targetIndex = closestSlotIndex(center, stableHitTestCenters);
		if (targetIndex !== null) {
			previewMove(targetIndex);
		}
	}

	/** Scroll step for the pointer's depth into the edge zones of the visible scroll container. */
	function pointerAutoScrollStep(): number {
		if (scrollContainer === document.scrollingElement) {
			return autoScrollStep(lastPointer.y, window.innerHeight);
		}
		const rect = scrollContainer.getBoundingClientRect();
		const visibleTop = Math.max(0, rect.top);
		const visibleBottom = Math.min(window.innerHeight, rect.bottom);
		return autoScrollStep(lastPointer.y - visibleTop, visibleBottom - visibleTop);
	}

	/** Pointer events stop while the page scrolls under a resting pointer, so each frame hit-tests. */
	function runAutoScroll() {
		autoScrollFrame = null;
		const step = pointerAutoScrollStep();
		if (activePointerId === null || step === 0) {
			return;
		}
		const previousScrollTop = scrollContainer.scrollTop;
		scrollContainer.scrollBy({ top: step, behavior: 'instant' });
		if (scrollContainer.scrollTop !== previousScrollTop) {
			previewAtDraggedCenter();
		}
		autoScrollFrame = requestAnimationFrame(runAutoScroll);
	}

	function stopAutoScroll() {
		if (autoScrollFrame !== null) {
			cancelAnimationFrame(autoScrollFrame);
			autoScrollFrame = null;
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== activePointerId) {
			return;
		}
		event.preventDefault();
		lastPointer = { x: event.clientX, y: event.clientY };
		moveOverlay();
		previewAtDraggedCenter();
		if (autoScrollFrame === null && pointerAutoScrollStep() !== 0) {
			autoScrollFrame = requestAnimationFrame(runAutoScroll);
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
			sourceElement.removeAttribute(GIFT_MOTION_DRAGGING_ATTRIBUTE);
		}
		sourceElement = null;
		sourceVisibility = '';
	}

	function cleanVisualState() {
		overlayElement?.remove();
		overlayElement = null;
		overlaySize = { width: 0, height: 0 };
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
		stopAutoScroll();
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
		groupedGeometry = null;
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
		scrollContainer = scrollContainerOf(element);
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
		lastGroupSwitchY = draggedContentCenter().y;
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
