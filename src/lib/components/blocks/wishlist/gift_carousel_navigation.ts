import type { Attachment } from 'svelte/attachments';

/** Subpixel layout can leave an aligned edge a fraction of a pixel off. */
const EDGE_TOLERANCE = 1;
const SCROLL_END_TOLERANCE = 2;

export interface VisibleCardRange {
	/** 1-based index of the first fully visible card. */
	first: number;
	/** 1-based index of the last fully visible card. */
	last: number;
	total: number;
}

/**
 * The cards fully inside a row's visible box, given each card's full visibility in row order.
 * Empty when every card fits, so the row has nothing to scroll to, or when no card is whole.
 */
export function visibleCardRange(cardsFullyVisible: readonly boolean[]): VisibleCardRange | null {
	const fullyVisibleIndexes = cardsFullyVisible.flatMap((fullyVisible, index) =>
		fullyVisible ? [index] : [],
	);
	const firstIndex = fullyVisibleIndexes.at(0);
	const lastIndex = fullyVisibleIndexes.at(-1);
	if (
		firstIndex === undefined ||
		lastIndex === undefined ||
		fullyVisibleIndexes.length === cardsFullyVisible.length
	) {
		return null;
	}
	return { first: firstIndex + 1, last: lastIndex + 1, total: cardsFullyVisible.length };
}

/**
 * The row the reader is in: the last one whose header has passed the line below the sticky
 * chrome, or the last row at the page bottom, where a short final row never reaches the line.
 * A header a jump aligned on the line counts as passed.
 */
export function currentCarouselRowIndex(
	headerTops: readonly number[],
	stickyLine: number,
	scrolledToBottom: boolean,
): number {
	if (scrolledToBottom) {
		return headerTops.length - 1;
	}
	let currentIndex = 0;
	headerTops.forEach((headerTop, index) => {
		if (headerTop < stickyLine + EDGE_TOLERANCE) {
			currentIndex = index;
		}
	});
	return currentIndex;
}

/**
 * Reports headers crossing the sticky line. The root margin puts the observer's top edge exactly
 * where `currentCarouselRowIndex` counts a header as passed, so a header aligned on the line still
 * crosses the edge and reports.
 */
export function observeStickyLineCrossings(
	headers: readonly Element[],
	scrollContainer: HTMLElement | null,
	stickyLine: number,
	oncrossing: () => void,
): IntersectionObserver {
	const options: IntersectionObserverInit = {
		rootMargin: `${-(stickyLine + EDGE_TOLERANCE)}px 0px 0px 0px`,
		threshold: [0, 1],
	};
	const intersectionObserver = createIntersectionObserver(oncrossing, scrollContainer, options);
	for (const header of headers) {
		intersectionObserver.observe(header);
	}
	return intersectionObserver;
}

function createIntersectionObserver(
	callback: () => void,
	scrollContainer: HTMLElement | null,
	options: IntersectionObserverInit,
): IntersectionObserver {
	if (scrollContainer !== null) {
		return new IntersectionObserver(callback, { ...options, root: scrollContainer });
	}
	try {
		// The document, unlike the implicit root, keeps the margin in this frame's viewport.
		return new IntersectionObserver(callback, { ...options, root: document });
	} catch {
		// Older browsers reject a Document root; the implicit root is the same viewport at top level.
		return new IntersectionObserver(callback, options);
	}
}

export function isScrolledToBottom(
	scrollTop: number,
	clientHeight: number,
	scrollHeight: number,
): boolean {
	return (
		scrollHeight > clientHeight &&
		scrollTop + clientHeight >= scrollHeight - SCROLL_END_TOLERANCE
	);
}

/**
 * Horizontal scroll position that brings an item into view with `inline: 'nearest'` semantics,
 * keeping `inset` clear at the edges. Positions are in the scroller's content coordinates.
 */
export function nearestInlineScrollLeft(
	scrollLeft: number,
	viewportWidth: number,
	itemStart: number,
	itemEnd: number,
	inset: number,
): number {
	if (itemStart - inset < scrollLeft) {
		return Math.max(0, itemStart - inset);
	}
	if (itemEnd + inset > scrollLeft + viewportWidth) {
		return itemEnd + inset - viewportWidth;
	}
	return scrollLeft;
}

/** A stable fragment id for a Carousel row, valid as a URL fragment and a CSS id selector. */
export function carouselSectionId(rowKey: string): string {
	return `gift-carousel-${rowKey.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

/** The nearest ancestor that scrolls vertically, or null when the viewport does. */
export function verticalScrollContainerOf(element: HTMLElement): HTMLElement | null {
	for (
		let ancestor = element.parentElement;
		ancestor !== null && ancestor !== document.body;
		ancestor = ancestor.parentElement
	) {
		const { overflowY } = getComputedStyle(ancestor);
		if (overflowY === 'auto' || overflowY === 'scroll') {
			return ancestor;
		}
	}
	return null;
}

/**
 * Reports the visible card range of a Carousel row as it scrolls or resizes. Attach it to the
 * row's track, whose parent is the native scroller and whose children are the slides. An
 * intersection observer reports only cards crossing an edge, so scrolling reads no layout.
 */
export function trackVisibleCardRange(
	onchange: (range: VisibleCardRange | null) => void,
): Attachment<HTMLElement> {
	return (track) => {
		const scroller = track.parentElement;
		if (scroller === null) {
			return;
		}
		const fullyVisibleSlides = new Map<Element, boolean>();
		const reportRange = () => {
			onchange(
				visibleCardRange(
					Array.from(track.children, (slide) => fullyVisibleSlides.get(slide) === true),
				),
			);
		};
		// The inline root margin lets a card overhang the row by the subpixel edge tolerance. The
		// root clips at the scroller's content box, so the gutter padding stays on the track.
		const intersectionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					fullyVisibleSlides.set(entry.target, entry.intersectionRatio >= 1);
				}
				reportRange();
			},
			{ root: scroller, rootMargin: `0px ${EDGE_TOLERANCE}px`, threshold: [0, 1] },
		);
		const observeSlides = () => {
			const slides = new Set(track.children);
			for (const slide of fullyVisibleSlides.keys()) {
				if (!slides.has(slide)) {
					intersectionObserver.unobserve(slide);
					fullyVisibleSlides.delete(slide);
				}
			}
			for (const slide of slides) {
				if (!fullyVisibleSlides.has(slide)) {
					fullyVisibleSlides.set(slide, false);
					intersectionObserver.observe(slide);
				}
			}
			reportRange();
		};
		const mutationObserver = new MutationObserver(observeSlides);
		mutationObserver.observe(track, { childList: true });
		observeSlides();
		return () => {
			intersectionObserver.disconnect();
			mutationObserver.disconnect();
		};
	};
}
