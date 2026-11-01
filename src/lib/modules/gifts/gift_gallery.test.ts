import { describe, expect, it } from 'vitest';
import {
	GIFT_GALLERY_INDICATOR_KINDS,
	classifyGallerySwipe,
	galleryIndicatorKind,
	galleryNeighbourIndexes,
	gallerySwipeStep,
	wrapGalleryIndex,
} from './gift_gallery.js';

describe('wrapGalleryIndex', () => {
	it('cycles past the last image back to the cover and before the cover to the last image', () => {
		expect(wrapGalleryIndex(5, 5)).toBe(0);
		expect(wrapGalleryIndex(-1, 5)).toBe(4);
		expect(wrapGalleryIndex(2, 5)).toBe(2);
	});

	it('keeps an index a shrunken gallery no longer has inside it', () => {
		expect(wrapGalleryIndex(7, 3)).toBe(1);
	});

	it('stays on the cover without a gallery', () => {
		expect(wrapGalleryIndex(3, 0)).toBe(0);
		expect(wrapGalleryIndex(3, 1)).toBe(0);
	});
});

describe('galleryNeighbourIndexes', () => {
	it('returns the previous and next image, wrapping around', () => {
		expect(galleryNeighbourIndexes(0, 5)).toEqual([4, 1]);
		expect(galleryNeighbourIndexes(4, 5)).toEqual([3, 0]);
	});

	it('names a two-image neighbour once', () => {
		expect(galleryNeighbourIndexes(0, 2)).toEqual([1]);
	});
});

describe('galleryIndicatorKind', () => {
	it('shows nothing for a single image or none', () => {
		expect(galleryIndicatorKind(0)).toBe(GIFT_GALLERY_INDICATOR_KINDS.none);
		expect(galleryIndicatorKind(1)).toBe(GIFT_GALLERY_INDICATOR_KINDS.none);
	});

	it('shows dots up to six images', () => {
		expect(galleryIndicatorKind(2)).toBe(GIFT_GALLERY_INDICATOR_KINDS.dots);
		expect(galleryIndicatorKind(6)).toBe(GIFT_GALLERY_INDICATOR_KINDS.dots);
	});

	it('shows an n/N counter above six images', () => {
		expect(galleryIndicatorKind(7)).toBe(GIFT_GALLERY_INDICATOR_KINDS.counter);
		expect(galleryIndicatorKind(8)).toBe(GIFT_GALLERY_INDICATOR_KINDS.counter);
	});
});

describe('classifyGallerySwipe', () => {
	it('waits until the finger has clearly moved', () => {
		expect(classifyGallerySwipe(4, 3)).toBe('pending');
	});

	it('takes a mostly horizontal movement as a swipe', () => {
		expect(classifyGallerySwipe(-24, 6)).toBe('horizontal');
		expect(classifyGallerySwipe(30, -10)).toBe('horizontal');
	});

	it('leaves vertical and diagonal movement to page scrolling', () => {
		expect(classifyGallerySwipe(3, 24)).toBe('vertical');
		expect(classifyGallerySwipe(20, 20)).toBe('vertical');
	});
});

describe('gallerySwipeStep', () => {
	it('moves to the next image after a leftward swipe past a fifth of the width', () => {
		expect(gallerySwipeStep(-61, 300)).toBe(1);
	});

	it('moves to the previous image after a rightward swipe past a fifth of the width', () => {
		expect(gallerySwipeStep(61, 300)).toBe(-1);
	});

	it('stays on the image after a short swipe', () => {
		expect(gallerySwipeStep(-40, 300)).toBe(0);
		expect(gallerySwipeStep(40, 300)).toBe(0);
	});
});
