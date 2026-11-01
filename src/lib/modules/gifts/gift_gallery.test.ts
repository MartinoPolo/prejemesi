import { describe, expect, it } from 'vitest';
import {
	GIFT_GALLERY_INDICATOR_KINDS,
	clampGalleryIndex,
	classifyGallerySwipe,
	galleryDragOffset,
	galleryIndicatorKind,
	galleryNeighbourIndexes,
	gallerySwipeStep,
} from './gift_gallery.js';

describe('clampGalleryIndex', () => {
	it('stops at the last image and at the cover instead of wrapping around', () => {
		expect(clampGalleryIndex(5, 5)).toBe(4);
		expect(clampGalleryIndex(-1, 5)).toBe(0);
		expect(clampGalleryIndex(2, 5)).toBe(2);
	});

	it('keeps an index a shrunken gallery no longer has on its last image', () => {
		expect(clampGalleryIndex(7, 3)).toBe(2);
	});

	it('stays on the cover without a gallery', () => {
		expect(clampGalleryIndex(3, 0)).toBe(0);
		expect(clampGalleryIndex(3, 1)).toBe(0);
	});
});

describe('galleryNeighbourIndexes', () => {
	it('returns the previous and next image', () => {
		expect(galleryNeighbourIndexes(2, 5)).toEqual([1, 3]);
	});

	it('has no neighbour beyond the cover or the last image', () => {
		expect(galleryNeighbourIndexes(0, 5)).toEqual([1]);
		expect(galleryNeighbourIndexes(4, 5)).toEqual([3]);
	});
});

describe('galleryDragOffset', () => {
	const width = 300;
	const fingerTravels = [-3000, -200, -120, -1, 1, 120, 200, 3000];

	it('moves the image exactly as far as the finger travels in the middle of the gallery', () => {
		for (const fingerTravel of fingerTravels) {
			expect(galleryDragOffset(fingerTravel, width, 1, 3)).toBe(fingerTravel);
		}
	});

	it('moves the image toward an existing neighbour exactly as far as the finger travels', () => {
		expect(galleryDragOffset(-120, width, 0, 3)).toBe(-120);
		expect(galleryDragOffset(120, width, 2, 3)).toBe(120);
	});

	it('moves the image less than the finger travels past the cover or the last image', () => {
		for (const [fingerTravel, index] of [
			[1, 0],
			[120, 0],
			[3000, 0],
			[-1, 2],
			[-120, 2],
			[-3000, 2],
		] as const) {
			const offset = galleryDragOffset(fingerTravel, width, index, 3);

			expect(Math.sign(offset)).toBe(Math.sign(fingerTravel));
			expect(Math.abs(offset)).toBeLessThan(Math.abs(fingerTravel));
			expect(Math.abs(offset)).toBeLessThan(width);
		}
	});

	it('pulls further the further the finger moves', () => {
		expect(galleryDragOffset(200, width, 0, 3)).toBeGreaterThan(
			galleryDragOffset(100, width, 0, 3),
		);
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
