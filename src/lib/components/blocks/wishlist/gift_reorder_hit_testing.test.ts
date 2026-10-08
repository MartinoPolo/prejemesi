import { describe, expect, it } from 'vitest';
import {
	autoScrollStep,
	boxCenter,
	closestGroupSlot,
	closestSlotIndex,
	draggedCardCenter,
	isPastCell,
	type Box,
	type Point,
} from './gift_reorder_hit_testing.js';

const CARD = { width: 200, height: 300 };
const GAP = { column: 20, row: 20 };
const COLUMNS = 3;
const REGION_RIGHT = COLUMNS * CARD.width + (COLUMNS - 1) * GAP.column;

function gridCell(index: number): Box {
	const column = index % COLUMNS;
	const row = Math.floor(index / COLUMNS);
	const left = column * (CARD.width + GAP.column);
	const top = row * (CARD.height + GAP.row);
	return { left, top, right: left + CARD.width, bottom: top + CARD.height };
}

function gridCells(count: number): Box[] {
	return Array.from({ length: count }, (_, index) => gridCell(index));
}

/** The pointer that grabbed `cell` at `grabOffset`, moved by `delta`, as the dragged card's center. */
function draggedFrom(cell: Box, grabOffset: Point, delta: Point): Point {
	return draggedCardCenter(
		{ x: cell.left + grabOffset.x + delta.x, y: cell.top + grabOffset.y + delta.y },
		grabOffset,
		CARD,
	);
}

/** Horizontal travel at which the dragged card first takes the target slot. */
function shiftThreshold(slots: Box[], from: number, to: number, grabOffset: Point): number {
	const centers = slots.map(boxCenter);
	const direction = Math.sign(to - from);
	for (let travel = 0; travel <= CARD.width * 2; travel += 1) {
		const center = draggedFrom(slots[from]!, grabOffset, { x: direction * travel, y: 0 });
		if (closestSlotIndex(center, centers) === to) {
			return travel;
		}
	}
	return Number.POSITIVE_INFINITY;
}

describe('gift reorder hit testing', () => {
	it('keeps a no-op drop on the starting slot wherever the card was grabbed', () => {
		const cells = gridCells(5);
		for (const grabOffset of [
			{ x: 8, y: 8 },
			{ x: 190, y: 290 },
		]) {
			expect(
				closestSlotIndex(
					draggedFrom(cells[1]!, grabOffset, { x: 0, y: 0 }),
					cells.map(boxCenter),
				),
			).toBe(1);
		}
	});

	it('shifts a neighbour at the same travel rightward and leftward, independent of the grab point', () => {
		const cells = gridCells(3);
		const gripCorner = { x: 16, y: 16 };
		const farCorner = { x: 184, y: 284 };
		// Half a slot step: the card's center crosses the midpoint between the two slot centers.
		const halfStep = (CARD.width + GAP.column) / 2;

		for (const threshold of [
			shiftThreshold(cells, 0, 1, gripCorner),
			shiftThreshold(cells, 1, 0, gripCorner),
			shiftThreshold(cells, 0, 1, farCorner),
			shiftThreshold(cells, 1, 0, farCorner),
		]) {
			expect(Math.abs(threshold - halfStep)).toBeLessThanOrEqual(1);
		}
	});

	it('takes the slot below once the card center is closer to it, in a single-column list', () => {
		const rows: Box[] = [0, 1].map((index) => ({
			left: 0,
			top: index * 120,
			right: 600,
			bottom: index * 120 + 100,
		}));
		const centers = rows.map(boxCenter);
		const grip = { x: 16, y: 16 };
		const center = (travel: number) =>
			draggedCardCenter({ x: grip.x, y: grip.y + travel }, grip, { width: 600, height: 100 });

		expect(closestSlotIndex(center(60), centers)).toBe(0);
		expect(closestSlotIndex(center(61), centers)).toBe(1);
	});

	it('moves the first of five cards to the second row start when its center reaches that slot', () => {
		const cells = gridCells(5);
		const grip = { x: 16, y: 16 };
		const centers = cells.map(boxCenter);
		const stepDown = CARD.height + GAP.row;

		expect(
			closestSlotIndex(draggedFrom(cells[0]!, grip, { x: 0, y: stepDown / 2 }), centers),
		).toBe(0);
		expect(
			closestSlotIndex(draggedFrom(cells[0]!, grip, { x: 0, y: stepDown / 2 + 1 }), centers),
		).toBe(3);
	});

	it('finds the closest rendered slot across groups, including an empty drop zone', () => {
		const slotCentersByGroup = new Map([
			['upper', [boxCenter(gridCell(0)), boxCenter(gridCell(1))]],
			['empty', [{ x: 300, y: 700 }]],
		]);

		expect(closestGroupSlot(boxCenter(gridCell(1)), slotCentersByGroup)).toEqual({
			groupKey: 'upper',
			index: 1,
		});
		expect(closestGroupSlot({ x: 320, y: 660 }, slotCentersByGroup)).toEqual({
			groupKey: 'empty',
			index: 0,
		});
		expect(closestGroupSlot({ x: 0, y: 0 }, new Map())).toBeNull();
	});

	describe('isPastCell', () => {
		it('compares a List row vertically, whatever the horizontal drift', () => {
			const row: Box = { left: 0, top: 100, right: REGION_RIGHT, bottom: 250 };
			expect(isPastCell({ x: 10, y: 176 }, row, REGION_RIGHT, GAP)).toBe(true);
			expect(isPastCell({ x: REGION_RIGHT - 10, y: 174 }, row, REGION_RIGHT, GAP)).toBe(
				false,
			);
		});

		it('compares a grid cell horizontally within its row, and by row outside it', () => {
			const middle = gridCell(1);
			const { x, y } = boxCenter(middle);
			expect(isPastCell({ x: x + 1, y }, middle, REGION_RIGHT, GAP)).toBe(true);
			expect(isPastCell({ x: x - 1, y }, middle, REGION_RIGHT, GAP)).toBe(false);
			expect(
				isPastCell({ x: x - 150, y: middle.bottom + 1 }, middle, REGION_RIGHT, GAP),
			).toBe(true);
			expect(isPastCell({ x: x + 150, y: middle.top - 1 }, middle, REGION_RIGHT, GAP)).toBe(
				false,
			);
		});

		it('compares the last grid column vertically, since the next slot starts a new row', () => {
			const lastColumn = gridCell(COLUMNS - 1);
			const { x, y } = boxCenter(lastColumn);
			expect(isPastCell({ x: x - 50, y: y + 1 }, lastColumn, REGION_RIGHT, GAP)).toBe(true);
			expect(isPastCell({ x: x + 50, y: y - 1 }, lastColumn, REGION_RIGHT, GAP)).toBe(false);
		});
	});

	describe('autoScrollStep', () => {
		const VIEWPORT = 800;

		it('rests outside the edge zones', () => {
			expect(autoScrollStep(400, VIEWPORT)).toBe(0);
			expect(autoScrollStep(96, VIEWPORT)).toBe(0);
			expect(autoScrollStep(704, VIEWPORT)).toBe(0);
		});

		it('scrolls up near the top and down near the bottom, faster deeper in the zone', () => {
			expect(autoScrollStep(80, VIEWPORT)).toBeLessThan(0);
			expect(autoScrollStep(10, VIEWPORT)).toBeLessThan(autoScrollStep(80, VIEWPORT));
			expect(autoScrollStep(720, VIEWPORT)).toBeGreaterThan(0);
			expect(autoScrollStep(790, VIEWPORT)).toBeGreaterThan(autoScrollStep(720, VIEWPORT));
		});

		it('caps the speed once the pointer leaves the viewport', () => {
			expect(autoScrollStep(-200, VIEWPORT)).toBe(autoScrollStep(0, VIEWPORT));
			expect(autoScrollStep(VIEWPORT + 200, VIEWPORT)).toBe(
				autoScrollStep(VIEWPORT, VIEWPORT),
			);
		});

		it('narrows the edge zone on short viewports', () => {
			expect(autoScrollStep(70, 300)).toBe(0);
			expect(autoScrollStep(50, 300)).toBeLessThan(0);
		});
	});
});
