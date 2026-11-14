import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	carouselSectionId,
	currentCarouselRowIndex,
	isScrolledToBottom,
	nearestInlineScrollLeft,
	observeStickyLineCrossings,
	visibleCardRange,
} from './gift_carousel_navigation.js';

/** Cards 100 px wide with a 10 px gap, the first starting at 12 px. */
function cardEdges(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		start: 12 + index * 110,
		end: 112 + index * 110,
	}));
}

describe('visibleCardRange (#640)', () => {
	it('reports the 1-based first and last fully visible cards with the total', () => {
		expect(visibleCardRange(cardEdges(5), 0, 240)).toEqual({ first: 1, last: 2, total: 5 });
	});

	it('ignores partly visible cards at either edge', () => {
		expect(visibleCardRange(cardEdges(5), 60, 400)).toEqual({ first: 2, last: 3, total: 5 });
	});

	it('counts a card overhanging the visible box by at most 1 px as fully visible', () => {
		expect(visibleCardRange(cardEdges(5), 13, 221)).toEqual({ first: 1, last: 2, total: 5 });
		expect(visibleCardRange(cardEdges(5), 13.5, 221)).toEqual({ first: 2, last: 2, total: 5 });
	});

	it('is empty when every card fits', () => {
		expect(visibleCardRange(cardEdges(2), 0, 375)).toBeNull();
	});

	it('is empty when no card is fully visible', () => {
		expect(visibleCardRange(cardEdges(3), 50, 130)).toBeNull();
	});

	it('is empty without cards', () => {
		expect(visibleCardRange([], 0, 375)).toBeNull();
	});
});

describe('currentCarouselRowIndex (#640)', () => {
	it('is the first row while no header has passed the sticky line', () => {
		expect(currentCarouselRowIndex([120, 480, 900], 100, false)).toBe(0);
	});

	it('is the last row whose header has passed the sticky line', () => {
		expect(currentCarouselRowIndex([-500, -20, 340], 100, false)).toBe(1);
	});

	it('counts a header aligned on the line, within 1 px, as passed', () => {
		expect(currentCarouselRowIndex([-300, 100.8, 600], 100, false)).toBe(1);
		expect(currentCarouselRowIndex([-300, 101.5, 600], 100, false)).toBe(0);
	});

	it('puts the boundary exactly 1 px below the line', () => {
		expect(currentCarouselRowIndex([-50, 100], 100, false)).toBe(1);
		expect(currentCarouselRowIndex([-50, 101], 100, false)).toBe(0);
	});

	it('is the last row once the page is scrolled to its bottom', () => {
		expect(currentCarouselRowIndex([-300, 200, 600], 100, true)).toBe(2);
	});
});

describe('observeStickyLineCrossings (#640)', () => {
	const unsupportedRootDocument = {};

	class DocumentRootRejectingObserver {
		readonly root: unknown;
		readonly observed: unknown[] = [];

		constructor(_callback: () => void, options: { root?: unknown } = {}) {
			if (options.root === unsupportedRootDocument) {
				throw new TypeError('Document is not a valid root');
			}
			this.root = options.root ?? null;
		}

		observe(target: unknown) {
			this.observed.push(target);
		}
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('falls back to the implicit root where a Document root is unsupported', () => {
		vi.stubGlobal('document', unsupportedRootDocument);
		vi.stubGlobal('IntersectionObserver', DocumentRootRejectingObserver);
		const headers = [{}, {}] as Element[];

		const intersectionObserver = observeStickyLineCrossings(headers, null, 100, () => {});

		const fallbackObserver = intersectionObserver as unknown as DocumentRootRejectingObserver;
		expect(fallbackObserver.root).toBeNull();
		expect(fallbackObserver.observed).toEqual(headers);
	});
});

describe('isScrolledToBottom (#640)', () => {
	it('is true at the end of a scrollable page, within 2 px', () => {
		expect(isScrolledToBottom(1200, 800, 2000)).toBe(true);
		expect(isScrolledToBottom(1198.5, 800, 2000)).toBe(true);
	});

	it('is false above the end', () => {
		expect(isScrolledToBottom(1100, 800, 2000)).toBe(false);
	});

	it('is false for a page that cannot scroll', () => {
		expect(isScrolledToBottom(0, 800, 800)).toBe(false);
	});
});

describe('nearestInlineScrollLeft (#640)', () => {
	it('keeps the scroll position while the item is inside the inset viewport', () => {
		expect(nearestInlineScrollLeft(100, 300, 150, 250, 12)).toBe(100);
	});

	it('aligns an item cut off at the start to the start inset', () => {
		expect(nearestInlineScrollLeft(100, 300, 90, 160, 12)).toBe(78);
	});

	it('aligns an item cut off at the end to the end inset', () => {
		expect(nearestInlineScrollLeft(0, 300, 260, 340, 12)).toBe(52);
	});

	it('never scrolls before the start', () => {
		expect(nearestInlineScrollLeft(20, 300, 5, 60, 12)).toBe(0);
	});
});

describe('carouselSectionId (#640)', () => {
	it('derives a stable id usable as a URL fragment and a CSS selector', () => {
		expect(carouselSectionId('category:books')).toBe('gift-carousel-category-books');
		expect(carouselSectionId('category:books')).toBe(carouselSectionId('category:books'));
		expect(carouselSectionId('priority:3f2a 9 é')).toMatch(/^[A-Za-z][\w-]*$/);
	});

	it('gives different rows different ids', () => {
		expect(carouselSectionId('own-reservations')).not.toBe(carouselSectionId('received'));
	});
});
