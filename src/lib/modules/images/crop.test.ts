import { describe, it, expect } from 'vitest';
import { cropRectToFocalZoom, focalZoomToCropRect, imageMetaToFrameProps } from './crop.js';
import { DEFAULT_IMAGE_METADATA, IMAGE_ZOOM_MAX } from './types.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

describe('cropRectToFocalZoom', () => {
	it('maps the full frame to a centered focal point at zoom 1', () => {
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 1,
		});
	});

	it('keeps the focal centered for a centered crop and zooms by the larger side', () => {
		expect(cropRectToFocalZoom({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 2,
		});
	});

	it('moves the focal to the centre of an off-centre crop', () => {
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 0.5, h: 0.5 })).toEqual({
			focal: { x: 25, y: 25 },
			zoom: 2,
		});
	});

	it('derives zoom from the longer side so the whole crop stays visible', () => {
		// max(0.6, 0.4) = 0.6 -> zoom 1/0.6
		const result = cropRectToFocalZoom({ x: 0.1, y: 0.2, w: 0.6, h: 0.4 });
		expect(result.focal).toEqual({ x: 40, y: 40 });
		expect(result.zoom).toBeCloseTo(1 / 0.6, 5);
	});

	it('clamps zoom to the maximum for tiny crops', () => {
		expect(cropRectToFocalZoom({ x: 0.45, y: 0.45, w: 0.05, h: 0.05 }).zoom).toBe(
			IMAGE_ZOOM_MAX,
		);
	});

	it('falls back to centre/zoom-1 for a degenerate rect', () => {
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 0, h: 0 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 1,
		});
	});
});

describe('focalZoomToCropRect', () => {
	it('returns the full frame for zoom 1', () => {
		expect(focalZoomToCropRect({ x: 50, y: 50 }, 1)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
	});

	it('returns a centred half-frame square for zoom 2 at centre focal', () => {
		expect(focalZoomToCropRect({ x: 50, y: 50 }, 2)).toEqual({
			x: 0.25,
			y: 0.25,
			w: 0.5,
			h: 0.5,
		});
	});

	it('clamps the rect inside the image bounds for an edge focal point', () => {
		// zoom 2 -> size 0.5; focal at 0% should clamp x to 0, not -0.25
		expect(focalZoomToCropRect({ x: 0, y: 0 }, 2)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
	});

	it('round-trips a centred crop through both conversions', () => {
		const rect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		const { focal, zoom } = cropRectToFocalZoom(rect);
		expect(focalZoomToCropRect(focal, zoom)).toEqual(rect);
	});
});

describe('imageMetaToFrameProps', () => {
	it('returns renderer defaults when metadata is null', () => {
		expect(imageMetaToFrameProps(null)).toEqual({
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { x: 50, y: 50 },
			zoom: 1,
			fillColor: null,
		});
	});

	it('passes through fit mode, focal, zoom and bgColor', () => {
		const props = imageMetaToFrameProps({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 30, y: 70 },
			zoom: 2,
			bgColor: '#abcdef',
		});
		expect(props).toEqual({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 30, y: 70 },
			zoom: 2,
			fillColor: '#abcdef',
		});
	});

	it('derives focal and zoom from cropRect when focal/zoom are absent', () => {
		const props = imageMetaToFrameProps({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
		});
		expect(props.focal).toEqual({ x: 25, y: 25 });
		expect(props.zoom).toBe(2);
	});

	it('uses the default metadata without throwing', () => {
		const props = imageMetaToFrameProps(DEFAULT_IMAGE_METADATA);
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.auto);
		expect(props.focal).toEqual({ x: 50, y: 50 });
		expect(props.zoom).toBe(1);
		expect(props.fillColor).toBeNull();
	});
});
