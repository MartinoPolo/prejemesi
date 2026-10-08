/**
 * Sortable geometry for pointer reorder: the dragged card's center picks the closest slot, so
 * neighbours shift at the same visual threshold in every direction (closest-center collision with
 * array-move semantics, as in dnd-kit or SortableJS).
 */

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface SlotGap {
	column: number;
	row: number;
}

export function boxCenter(box: Box): Point {
	return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

export function unionBox(first: Box, second: Box): Box {
	return {
		left: Math.min(first.left, second.left),
		top: Math.min(first.top, second.top),
		right: Math.max(first.right, second.right),
		bottom: Math.max(first.bottom, second.bottom),
	};
}

/** Center of the dragged card from the pointer, where it grabbed the card, and the card's size. */
export function draggedCardCenter(pointer: Point, grabOffset: Point, size: Size): Point {
	return {
		x: pointer.x - grabOffset.x + size.width / 2,
		y: pointer.y - grabOffset.y + size.height / 2,
	};
}

/** Index of the slot whose center is closest to `point`; the earlier slot wins a tie. */
export function closestSlotIndex(point: Point, slotCenters: readonly Point[]): number | null {
	let closestIndex: number | null = null;
	let closestDistance = Number.POSITIVE_INFINITY;
	slotCenters.forEach((center, index) => {
		const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = index;
		}
	});
	return closestIndex;
}

/**
 * Whether a card entering a group lands after `cell` rather than before it, in reading order:
 * past its center within its row, or below its row. A cell with no room for another column
 * beside it, such as a List row, only compares vertically.
 */
export function isPastCell(point: Point, cell: Box, regionRight: number, gap: SlotGap): boolean {
	const center = boxCenter(cell);
	const nextColumnFits = cell.right + gap.column + (cell.right - cell.left) <= regionRight + 1;
	if (!nextColumnFits || point.y < cell.top || point.y > cell.bottom) {
		return point.y > center.y;
	}
	return point.x > center.x;
}

export interface GroupSlotHit {
	groupKey: string;
	index: number;
}

/** The closest slot across every group: a gift cell, or the drop zone of an empty group. */
export function closestGroupSlot(
	point: Point,
	slotCentersByGroup: ReadonlyMap<string, readonly Point[]>,
): GroupSlotHit | null {
	const groupKeys = [...slotCentersByGroup.keys()];
	const flattened = groupKeys.flatMap((groupKey) =>
		slotCentersByGroup.get(groupKey)!.map((center, index) => ({ groupKey, index, center })),
	);
	const closestIndex = closestSlotIndex(
		point,
		flattened.map((slot) => slot.center),
	);
	const closest = closestIndex === null ? undefined : flattened[closestIndex];
	return closest === undefined ? null : { groupKey: closest.groupKey, index: closest.index };
}

const AUTO_SCROLL_EDGE_SIZE = 96;
const AUTO_SCROLL_EDGE_SHARE = 0.2;
const AUTO_SCROLL_MAXIMUM_STEP = 24;

/**
 * Pixels to scroll this frame while dragging: negative near the top edge, positive near the bottom,
 * growing with how deep the pointer is in the edge zone, and full speed past the viewport edge.
 */
export function autoScrollStep(pointerY: number, viewportHeight: number): number {
	const edgeSize = Math.min(AUTO_SCROLL_EDGE_SIZE, viewportHeight * AUTO_SCROLL_EDGE_SHARE);
	if (edgeSize <= 0) {
		return 0;
	}
	const topDepth = (edgeSize - pointerY) / edgeSize;
	const bottomDepth = (pointerY - (viewportHeight - edgeSize)) / edgeSize;
	if (topDepth > 0) {
		return -Math.ceil(Math.min(topDepth, 1) * AUTO_SCROLL_MAXIMUM_STEP);
	}
	if (bottomDepth > 0) {
		return Math.ceil(Math.min(bottomDepth, 1) * AUTO_SCROLL_MAXIMUM_STEP);
	}
	return 0;
}
