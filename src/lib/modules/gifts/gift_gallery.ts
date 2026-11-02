/** Most images the dot indicator shows; larger galleries show an `n/N` counter instead. */
const GIFT_GALLERY_MAX_DOTS = 6;

export const GIFT_GALLERY_INDICATOR_KINDS = {
	none: 'none',
	dots: 'dots',
	counter: 'counter',
} as const;

export type GiftGalleryIndicatorKind =
	(typeof GIFT_GALLERY_INDICATOR_KINDS)[keyof typeof GIFT_GALLERY_INDICATOR_KINDS];

/** Movement in CSS pixels before a touch counts as a swipe or a scroll. */
const SWIPE_INTENT_DISTANCE = 10;
/** Horizontal movement must exceed vertical by this factor, so diagonal drags still scroll. */
const SWIPE_HORIZONTAL_DOMINANCE = 1.2;
/** Share of the image width a released swipe must cover to change the image. */
const SWIPE_COMMIT_SHARE = 0.2;

/** Stiffness of the rubber band past the first or last image, which never travels a full width. */
const EDGE_RESISTANCE = 0.55;

export type GallerySwipeIntent = 'pending' | 'horizontal' | 'vertical';

/** The gallery position an index lands on; browsing stops at the first and last image. */
export function clampGalleryIndex(index: number, count: number): number {
	return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

/** The previous and next images of a position that exist. */
export function galleryNeighbourIndexes(index: number, count: number): number[] {
	return [index - 1, index + 1].filter((neighbour) => neighbour >= 0 && neighbour < count);
}

/**
 * How far the shown image follows a finger dragged by `deltaX`: fully toward an existing
 * neighbour, with rubber-band resistance past the first or last image.
 */
export function galleryDragOffset(
	deltaX: number,
	width: number,
	index: number,
	count: number,
): number {
	const towardIndex = index + (deltaX < 0 ? 1 : -1);
	if (width <= 0 || (towardIndex >= 0 && towardIndex < count)) {
		return deltaX;
	}
	const resisted = width * (1 - 1 / ((Math.abs(deltaX) * EDGE_RESISTANCE) / width + 1));
	return Math.sign(deltaX) * resisted;
}

export function galleryIndicatorKind(count: number): GiftGalleryIndicatorKind {
	if (count < 2) {
		return GIFT_GALLERY_INDICATOR_KINDS.none;
	}
	return count > GIFT_GALLERY_MAX_DOTS
		? GIFT_GALLERY_INDICATOR_KINDS.counter
		: GIFT_GALLERY_INDICATOR_KINDS.dots;
}

/** Whether a touch moving by this offset browses the gallery or scrolls the page. */
export function classifyGallerySwipe(deltaX: number, deltaY: number): GallerySwipeIntent {
	const horizontal = Math.abs(deltaX);
	const vertical = Math.abs(deltaY);
	if (Math.max(horizontal, vertical) < SWIPE_INTENT_DISTANCE) {
		return 'pending';
	}
	return horizontal > vertical * SWIPE_HORIZONTAL_DOMINANCE ? 'horizontal' : 'vertical';
}

/** The image step a released swipe makes: a leftward swipe shows the next image. */
export function gallerySwipeStep(deltaX: number, width: number): -1 | 0 | 1 {
	if (Math.abs(deltaX) < width * SWIPE_COMMIT_SHARE) {
		return 0;
	}
	return deltaX < 0 ? 1 : -1;
}
