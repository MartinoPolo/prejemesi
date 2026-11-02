import { describe, it, expect } from 'vitest';
import {
	containZoomForAspect,
	cropRectToFocalZoom,
	focalZoomToWindowRect,
	normalizedCropAspect,
	centeredCropRect,
	panCropRect,
	zoomCropRect,
	containCropRect,
	centerCropRectOn,
	alignCropRect,
	reprojectCropRect,
	fitCropRectToAspect,
	seedCropRectFromLegacyMeta,
	zoomOutFloorForAspect,
	cropRectAroundBox,
	framedGiftImageMeta,
	FULL_CROP_RECT,
} from './crop.js';
import * as v from 'valibot';
import {
	GIFT_FRAMING_DEFAULT_GAP_PER_SIDE,
	IMAGE_ZOOM_MAX,
	IMAGE_ZOOM_OUT_GAP_PER_SIDE,
	IMAGE_ZOOM_OUT_MIN,
	ImageMetadataSchema,
	type ImageCropRect,
} from './types.js';
import { expectRectClose } from './crop.test_fixtures.js';

describe('normalizedCropAspect', () => {
	it('relates the target pixel aspect to the source image ratio', () => {
		// 1:1 target on a 16:9 image: the normalized rect is half as wide as tall.
		expect(normalizedCropAspect(1, 16 / 9)).toBeCloseTo(9 / 16, 10);
	});

	it('falls back to square for degenerate inputs', () => {
		expect(normalizedCropAspect(0, 1.5)).toBe(1);
		expect(normalizedCropAspect(1.5, 0)).toBe(1);
		expect(normalizedCropAspect(Number.NaN, 1)).toBe(1);
	});
});

describe('containZoomForAspect', () => {
	it('is the zoom at which the whole image exactly fits the window', () => {
		expect(containZoomForAspect(1)).toBe(1);
		expect(containZoomForAspect(2)).toBeCloseTo(0.5, 10);
		expect(containZoomForAspect(0.5)).toBeCloseTo(0.5, 10);
	});

	it('never drops below the absolute zoom-out floor', () => {
		expect(containZoomForAspect(1000)).toBe(IMAGE_ZOOM_OUT_MIN);
	});

	it('falls back to the cover baseline for degenerate aspects', () => {
		expect(containZoomForAspect(0)).toBe(1);
		expect(containZoomForAspect(Number.NaN)).toBe(1);
	});
});

describe('zoomOutFloorForAspect', () => {
	it('lets the whole image shrink until 15 % of the window is clear on each side of the tighter axis', () => {
		expect(zoomOutFloorForAspect(1)).toBeCloseTo(0.7, 10);
		expect(zoomOutFloorForAspect(2)).toBeCloseTo(0.35, 10);
		expect(zoomOutFloorForAspect(0.5)).toBeCloseTo(0.35, 10);
		// The image covers 70 % of the window's tighter axis at the floor.
		const { h } = focalZoomToWindowRect({ x: 50, y: 50 }, zoomOutFloorForAspect(2), 2);
		expect(1 / h).toBeCloseTo(0.7, 10);
	});

	it('never drops below the absolute zoom-out floor', () => {
		expect(zoomOutFloorForAspect(1000)).toBe(IMAGE_ZOOM_OUT_MIN);
	});
});

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

	it('maps a corner-anchored crop to a corner focal (exact renderer semantics)', () => {
		// object-position 0% pins the window to the left/top edge, so origin 0 → focal 0,
		// NOT the rect-center 25% the pre-#116 conversion produced (which the renderer
		// then displaced to origin 0.125).
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 0.5, h: 0.5 })).toEqual({
			focal: { x: 0, y: 0 },
			zoom: 2,
		});
	});

	it('maps a zoomed-out (oversized) window to the same exact-inverse focal (#116 round 2)', () => {
		// A centered contain window on normalized aspect 2: both origin and (1 - size)
		// are negative, so focal = origin / (1 - size) still positions the image.
		expect(cropRectToFocalZoom({ x: -0.5, y: 0, w: 2, h: 1 })).toEqual({
			focal: { x: 50, y: 50 },
			zoom: 0.5,
		});
		// Image flush with the window's left edge → focal 0, flush right → focal 100.
		expect(cropRectToFocalZoom({ x: 0, y: 0, w: 2, h: 1 }).focal.x).toBe(0);
		expect(cropRectToFocalZoom({ x: -1, y: 0, w: 2, h: 1 }).focal.x).toBe(100);
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

describe('focalZoomToWindowRect', () => {
	it('returns the centered cover window at zoom 1', () => {
		// Normalized aspect 0.5 (e.g. a 1:1 slot on a 2:1 image): full height, half width.
		expectRectClose(focalZoomToWindowRect({ x: 50, y: 50 }, 1, 0.5), {
			x: 0.25,
			y: 0,
			w: 0.5,
			h: 1,
		});
	});

	it('pins the window to the edge for an edge focal point', () => {
		expectRectClose(focalZoomToWindowRect({ x: 0, y: 0 }, 2, 1), {
			x: 0,
			y: 0,
			w: 0.5,
			h: 0.5,
		});
	});

	it('round-trips any aspect-matched rect losslessly (REQ-3/D5)', () => {
		// Rects drawn per target always match the target aspect; the focal+zoom
		// persisted from them must reproduce the exact same window at render time.
		const cases: { rect: ImageCropRect; aspect: number }[] = [
			{ rect: { x: 0.1, y: 0, w: 0.6, h: 1 }, aspect: 0.6 },
			{ rect: { x: 0, y: 0.3, w: 1, h: 0.4 }, aspect: 2.5 },
			{ rect: { x: 0.42, y: 0.13, w: 0.5, h: 0.25 }, aspect: 2 },
			{ rect: { x: 0.65, y: 0.61, w: 0.35, h: 0.39 }, aspect: 0.35 / 0.39 },
		];
		for (const { rect, aspect } of cases) {
			const { focal, zoom } = cropRectToFocalZoom(rect);
			expectRectClose(focalZoomToWindowRect(focal, zoom, aspect), rect);
		}
	});

	it('round-trips zoomed-out (letterboxed) rects losslessly (#116 round 2)', () => {
		const cases: { rect: ImageCropRect; aspect: number }[] = [
			// Contain window on a wide normalized aspect, centered and edge-pinned.
			{ rect: { x: -0.5, y: 0, w: 2, h: 1 }, aspect: 2 },
			{ rect: { x: 0, y: 0, w: 2, h: 1 }, aspect: 2 },
			// In-between zoom-out: horizontal overhang, vertical still cropped.
			{ rect: { x: -0.125, y: 0.1875, w: 1.25, h: 0.625 }, aspect: 2 },
			// Tall normalized aspect letterboxes vertically instead.
			{ rect: { x: 0.2, y: -0.3, w: 0.8, h: 1.6 }, aspect: 0.5 },
			// Past the contain zoom: gaps on both axes, off-center.
			{ rect: { x: -1.2, y: -0.1, w: 2.5, h: 1.25 }, aspect: 2 },
		];
		for (const { rect, aspect } of cases) {
			const { focal, zoom } = cropRectToFocalZoom(rect);
			expect(zoom).toBeLessThan(1);
			expectRectClose(focalZoomToWindowRect(focal, zoom, aspect), rect);
		}
	});

	it('renders exactly the contain framing at the contain zoom', () => {
		const aspect = 2.5;
		const rect = focalZoomToWindowRect({ x: 50, y: 50 }, containZoomForAspect(aspect), aspect);
		// The image spans the window fully on one axis and is centered on the other.
		expectRectClose(rect, { x: -0.75, y: 0, w: 2.5, h: 1 });
	});

	it('never discards a full-width strip crop on a narrower slot (F7 regression)', () => {
		// F7 worked example: a strip crop y=[0.3..0.7] over the full width. In the
		// pre-#116 model zoom collapsed to 1 and a 1:1 slot rendered x=[0.22..0.78]
		// full-height instead of the drawn band. Per-target rects make the drawn
		// band exactly reproducible on its own target.
		const strip: ImageCropRect = { x: 0, y: 0.3, w: 1, h: 0.4 };
		const { focal, zoom } = cropRectToFocalZoom(strip);
		expect(zoom).toBeCloseTo(1, 10);
		// Rendered on the surface the strip was drawn for (normalized aspect 2.5):
		const rendered = focalZoomToWindowRect(focal, zoom, 1 / 0.4);
		expectRectClose(rendered, strip);
	});
});

describe('seedCropRectFromLegacyMeta', () => {
	it('restores an exact per-target/slot cropRect verbatim', () => {
		const cropRect: ImageCropRect = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };
		expectRectClose(seedCropRectFromLegacyMeta({ cropRect }), cropRect);
	});

	it('restores a base-level cropRect verbatim', () => {
		const cropRect: ImageCropRect = { x: 0.05, y: 0, w: 0.9, h: 1 };
		expectRectClose(seedCropRectFromLegacyMeta({ cropRect }), cropRect);
	});

	it('issue #123: reconstructs a legacy focal/zoom row instead of discarding it', () => {
		// An off-center legacy focal point with no cropRect must NOT seed as the
		// always-centered FULL_CROP_RECT — that is the silent square/center-ify bug:
		// the reconstructed rect's center must reflect the persisted focal point.
		const focal = { x: 20, y: 80 };
		const zoom = 1.5;
		const seeded = seedCropRectFromLegacyMeta({ focal, zoom });
		expect(seeded).not.toEqual(FULL_CROP_RECT);
		expectRectClose(seeded, focalZoomToWindowRect(focal, zoom, 1));
	});

	it('falls back to FULL_CROP_RECT only when neither cropRect nor focal/zoom exist', () => {
		expectRectClose(seedCropRectFromLegacyMeta({}), FULL_CROP_RECT);
		expectRectClose(seedCropRectFromLegacyMeta({ focal: { x: 50, y: 50 } }), FULL_CROP_RECT);
		expectRectClose(seedCropRectFromLegacyMeta({ zoom: 1 }), FULL_CROP_RECT);
	});

	it('prefers cropRect over focal/zoom when both are present', () => {
		const cropRect: ImageCropRect = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
		expectRectClose(
			seedCropRectFromLegacyMeta({ cropRect, focal: { x: 90, y: 10 }, zoom: 2 }),
			cropRect,
		);
	});
});

describe('centeredCropRect', () => {
	it('produces the automatic center cover window (D1/REQ-1)', () => {
		expectRectClose(centeredCropRect(0.5), { x: 0.25, y: 0, w: 0.5, h: 1 });
		expectRectClose(centeredCropRect(2), { x: 0, y: 0.25, w: 1, h: 0.5 });
		expectRectClose(centeredCropRect(1), FULL_CROP_RECT);
	});
});

describe('panCropRect', () => {
	it('translates and clamps inside the unit square', () => {
		const rect: ImageCropRect = { x: 0.2, y: 0, w: 0.5, h: 1 };
		expectRectClose(panCropRect(rect, 0.1, 0.5), { x: 0.3, y: 0, w: 0.5, h: 1 });
		expectRectClose(panCropRect(rect, 9, 0), { x: 0.5, y: 0, w: 0.5, h: 1 });
		expectRectClose(panCropRect(rect, -9, 0), { x: 0, y: 0, w: 0.5, h: 1 });
	});

	it('keeps the image inside an oversized (zoomed-out) window', () => {
		// Window twice as wide as the image: the image slides between flush-left
		// (origin 0) and flush-right (origin 1 - size = -1), never outside.
		const rect: ImageCropRect = { x: -0.5, y: 0, w: 2, h: 1 };
		expectRectClose(panCropRect(rect, 0.2, 0), { x: -0.3, y: 0, w: 2, h: 1 });
		expectRectClose(panCropRect(rect, 9, 0), { x: 0, y: 0, w: 2, h: 1 });
		expectRectClose(panCropRect(rect, -9, 0), { x: -1, y: 0, w: 2, h: 1 });
	});

	it('keeps the image inside a window oversized on both axes', () => {
		const rect: ImageCropRect = { x: -0.75, y: -0.125, w: 2.5, h: 1.25 };
		expectRectClose(panCropRect(rect, 9, 9), { x: 0, y: 0, w: 2.5, h: 1.25 });
		expectRectClose(panCropRect(rect, -9, -9), { x: -1.5, y: -0.25, w: 2.5, h: 1.25 });
	});
});

describe('zoomCropRect', () => {
	it('resizes around the current center preserving the aspect', () => {
		const rect: ImageCropRect = { x: 0.25, y: 0, w: 0.5, h: 1 };
		const zoomed = zoomCropRect(rect, 0.5, 2);
		expectRectClose(zoomed, { x: 0.375, y: 0.25, w: 0.25, h: 0.5 });
	});

	it('clamps back inside bounds when zooming out near an edge', () => {
		const rect: ImageCropRect = { x: 0.75, y: 0.5, w: 0.25, h: 0.5 };
		const zoomed = zoomCropRect(rect, 0.5, 1);
		expectRectClose(zoomed, { x: 0.5, y: 0, w: 0.5, h: 1 });
	});

	it('zooms out below 100 %, keeping the covered axis covered down to the contain zoom', () => {
		const centered = centeredCropRect(2);
		// 80 % keeps the covered axis covered while the other overhangs.
		expectRectClose(zoomCropRect(centered, 2, 0.8), {
			x: -0.125,
			y: 0.1875,
			w: 1.25,
			h: 0.625,
		});
	});

	it('zooms out past the contain zoom with a gap on both axes', () => {
		// Contain is 50 % at this aspect; 40 % shrinks the whole image on both axes.
		expectRectClose(zoomCropRect(containCropRect(2), 2, 0.4), {
			x: -0.75,
			y: -0.125,
			w: 2.5,
			h: 1.25,
		});
	});

	it('stops at 15 % clear per side of the tighter axis', () => {
		const floored = zoomCropRect(centeredCropRect(2), 2, 0.1);
		expectRectClose(floored, { x: 0.5 - 1 / 0.7, y: -0.15 / 0.7, w: 2 / 0.7, h: 1 / 0.7 });
		expect(cropRectToFocalZoom(floored).zoom).toBeCloseTo(zoomOutFloorForAspect(2), 10);
	});
});

describe('zoomCropRect around an anchor (#533)', () => {
	it('keeps the source point under the pointer fixed while zooming in', () => {
		const rect: ImageCropRect = { x: 0, y: 0, w: 1, h: 1 };
		const zoomed = zoomCropRect(rect, 1, 2, { x: 0.25, y: 0.25 });
		// The source point (0.25, 0.25) stays at the same window fraction.
		expect(zoomed.x + zoomed.w * 0.25).toBeCloseTo(0.25, 10);
		expect(zoomed.y + zoomed.h * 0.25).toBeCloseTo(0.25, 10);
		expectRectClose(zoomed, { x: 0.125, y: 0.125, w: 0.5, h: 0.5 });
	});
});

describe('containCropRect', () => {
	it('shows the whole image centered, letterboxed on one axis without a margin', () => {
		expectRectClose(containCropRect(2), { x: -0.5, y: 0, w: 2, h: 1 });
		expectRectClose(containCropRect(0.5), { x: 0, y: -0.5, w: 1, h: 2 });
		expectRectClose(containCropRect(1), FULL_CROP_RECT);
	});
});

describe('centerCropRectOn', () => {
	it('moves the window center onto a source point without resizing', () => {
		const rect: ImageCropRect = { x: 0, y: 0, w: 0.5, h: 0.5 };
		expectRectClose(centerCropRectOn(rect, { x: 0.5, y: 0.5 }), {
			x: 0.25,
			y: 0.25,
			w: 0.5,
			h: 0.5,
		});
	});

	it('stays inside the image near an edge', () => {
		const rect: ImageCropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		expectRectClose(centerCropRectOn(rect, { x: 1, y: 0 }), { x: 0.5, y: 0, w: 0.5, h: 0.5 });
	});
});

describe('alignCropRect', () => {
	it('snaps the window to a corner, an edge or the center at its current size', () => {
		const rect: ImageCropRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 };
		expectRectClose(alignCropRect(rect, { x: 0, y: 0 }), { x: 0, y: 0, w: 0.5, h: 0.4 });
		expectRectClose(alignCropRect(rect, { x: 1, y: 1 }), { x: 0.5, y: 0.6, w: 0.5, h: 0.4 });
		expectRectClose(alignCropRect(rect, { x: 0.5, y: 0.5 }), {
			x: 0.25,
			y: 0.3,
			w: 0.5,
			h: 0.4,
		});
	});

	it('maps the alignment to the renderer focal percentage', () => {
		const aligned = alignCropRect({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 1, y: 0 });
		expect(cropRectToFocalZoom(aligned).focal).toEqual({ x: 100, y: 0 });
	});
});

describe('reprojectCropRect', () => {
	it('keeps focal point and zoom when re-shaping for another target aspect', () => {
		const card: ImageCropRect = { x: 0.2, y: 0.1, w: 0.5, h: 0.5 };
		const thumb = reprojectCropRect(card, 0.75);
		const source = cropRectToFocalZoom(card);
		const reprojected = cropRectToFocalZoom(thumb);
		expect(reprojected.zoom).toBeCloseTo(source.zoom, 6);
		expect(reprojected.focal.x).toBeCloseTo(source.focal.x, 6);
		expect(reprojected.focal.y).toBeCloseTo(source.focal.y, 6);
		expect(thumb.w / thumb.h).toBeCloseTo(0.75, 6);
	});

	it('keeps a crop zoomed out past contain inside its window on the other aspect', () => {
		// A card crop at its floor (4:3 on a square photo) shown on the 1:1 thumb.
		const card = zoomCropRect(centeredCropRect(4 / 3), 4 / 3, 0);
		const thumb = reprojectCropRect(card, 1);
		expect(cropRectToFocalZoom(thumb).zoom).toBeCloseTo(cropRectToFocalZoom(card).zoom, 6);
		expectRectClose(thumb, {
			x: 0.5 - thumb.w / 2,
			y: 0.5 - thumb.h / 2,
			w: thumb.w,
			h: thumb.w,
		});
		expect(thumb.w).toBeGreaterThan(1);
	});
});

describe('fitCropRectToAspect', () => {
	it('returns aspect-matched rects unchanged', () => {
		const rect: ImageCropRect = { x: 0.1, y: 0.2, w: 0.4, h: 0.8 };
		expectRectClose(fitCropRectToAspect(rect, 0.5), rect);
	});

	it('re-shapes a legacy square rect around its center', () => {
		// Legacy pre-#116 restore rects were square; editing a 2:1-normalized target
		// keeps the center and covers the old extent.
		const legacy: ImageCropRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
		expectRectClose(fitCropRectToAspect(legacy, 2), { x: 0, y: 0.25, w: 1, h: 0.5 });
	});

	it('respects the renderer zoom bounds so no saved crop can exceed max zoom', () => {
		const tiny: ImageCropRect = { x: 0.5, y: 0.5, w: 0.02, h: 0.02 };
		const fitted = fitCropRectToAspect(tiny, 1);
		expect(Math.max(fitted.w, fitted.h)).toBeGreaterThanOrEqual(1 / IMAGE_ZOOM_MAX - 1e-9);
	});

	it('preserves aspect-matched zoomed-out rects (one-axis letterbox)', () => {
		const contain: ImageCropRect = { x: -0.5, y: 0, w: 2, h: 1 };
		expectRectClose(fitCropRectToAspect(contain, 2), contain);
	});

	it('preserves aspect-matched rects zoomed out past contain', () => {
		const pastContain: ImageCropRect = { x: -1.2, y: -0.1, w: 2.5, h: 1.25 };
		expectRectClose(fitCropRectToAspect(pastContain, 2), pastContain);
		const atFloor = zoomCropRect(centeredCropRect(2), 2, 0);
		expectRectClose(fitCropRectToAspect(atFloor, 2), atFloor);
	});

	it('keeps an aspect-matched rect below its target floor unchanged', () => {
		// A 1:1 window twice the image's size is zoom 0.5, below the 1:1 floor of 0.7.
		const belowFloor: ImageCropRect = { x: -0.5, y: -0.5, w: 2, h: 2 };
		expect(cropRectToFocalZoom(belowFloor).zoom).toBeLessThan(zoomOutFloorForAspect(1));
		expectRectClose(fitCropRectToAspect(belowFloor, 1), belowFloor);
	});

	it('preserves a thumbnail following a card crop zoomed out deeper than its own floor', () => {
		// A square photo: the 4:3 card may zoom out further than the 1:1 thumb.
		const card = zoomCropRect(centeredCropRect(4 / 3), 4 / 3, 0);
		const followingThumb = reprojectCropRect(card, 1);
		expect(cropRectToFocalZoom(followingThumb).zoom).toBeLessThan(zoomOutFloorForAspect(1));
		expectRectClose(fitCropRectToAspect(followingThumb, 1), followingThumb);
	});

	it('shrinks a window beyond the renderer zoom-out bound back to it around its center', () => {
		const oversized: ImageCropRect = { x: -24.5, y: -24.5, w: 50, h: 50 };
		const fitted = fitCropRectToAspect(oversized, 1);
		expect(Math.max(fitted.w, fitted.h)).toBeCloseTo(1 / IMAGE_ZOOM_OUT_MIN, 10);
		expect(fitted.x + fitted.w / 2).toBeCloseTo(0.5, 10);
		expect(fitted.y + fitted.h / 2).toBeCloseTo(0.5, 10);
	});

	it('falls back to the centered window for degenerate rects', () => {
		expectRectClose(
			fitCropRectToAspect({ x: 0, y: 0, w: 0, h: 0 }, 0.5),
			centeredCropRect(0.5),
		);
	});
});

describe('cropRectAroundBox', () => {
	const gap = GIFT_FRAMING_DEFAULT_GAP_PER_SIDE;
	// The product spans 1 - 2 × gap of the window on its limiting axis.
	const boxShare = 1 - 2 * gap;

	it('frames a whole-image 3:4 box shot on the 4:3 card with the gap on every side', () => {
		// A 3:4 photo on a 4:3 card: normalized aspect (4/3) / (3/4) = 16/9. The photo's
		// height limits it, so the window is 1 / 0.85 tall and 16/9 times that wide;
		// centered, the photo spans 85 % of the window height with 7.5 % above and below.
		const aspect = normalizedCropAspect(4 / 3, 3 / 4);
		const rect = cropRectAroundBox(FULL_CROP_RECT, aspect, gap);
		const height = 1 / boxShare;
		const width = (16 / 9) * height;
		expectRectClose(rect, { x: 0.5 - width / 2, y: 0.5 - height / 2, w: width, h: height });
		expect(1 / rect.h).toBeCloseTo(boxShare, 10);
		// Horizontally the photo covers 9/16 of 85 % of the window, centered.
		expect(-rect.x / rect.w).toBeCloseTo((1 - boxShare * (9 / 16)) / 2, 10);
	});

	it('frames the same box shot on the 1:1 thumbnail with the gap on every side', () => {
		// A 3:4 photo on a 1:1 thumb: normalized aspect 1 / (3/4) = 4/3; again height-limited.
		const aspect = normalizedCropAspect(1, 3 / 4);
		const rect = cropRectAroundBox(FULL_CROP_RECT, aspect, gap);
		const height = 1 / boxShare;
		const width = (4 / 3) * height;
		expectRectClose(rect, { x: 0.5 - width / 2, y: 0.5 - height / 2, w: width, h: height });
	});

	it('frames a small product in a large empty area tighter than the whole image', () => {
		// A 300×300 px product centered in a 1500×1000 px photo: box 0.2 × 0.3 normalized.
		// Card aspect (4/3) / 1.5 = 8/9; the box height limits (0.3 × 8/9 > 0.2), so the
		// window is 0.3 / 0.85 tall and the product fills 85 % of its height.
		const aspect = normalizedCropAspect(4 / 3, 1.5);
		const box: ImageCropRect = { x: 0.4, y: 0.35, w: 0.2, h: 0.3 };
		const rect = cropRectAroundBox(box, aspect, gap);
		const height = 0.3 / boxShare;
		const width = (8 / 9) * height;
		expectRectClose(rect, { x: 0.5 - width / 2, y: 0.5 - height / 2, w: width, h: height });
		expect(cropRectToFocalZoom(rect).zoom).toBeGreaterThan(1);
	});

	it('stops at the maximum zoom for a tiny product, centered on it', () => {
		const box: ImageCropRect = { x: 0.3, y: 0.6, w: 0.05, h: 0.05 };
		const rect = cropRectAroundBox(box, 1, gap);
		expectRectClose(rect, {
			x: 0.325 - 1 / (2 * IMAGE_ZOOM_MAX),
			y: 0.625 - 1 / (2 * IMAGE_ZOOM_MAX),
			w: 1 / IMAGE_ZOOM_MAX,
			h: 1 / IMAGE_ZOOM_MAX,
		});
	});

	it('frames a product touching two image edges like the whole image', () => {
		// A product in the top-left corner of a 1500×1000 px photo (its top a hair below
		// the edge) spans the whole image on both axes, so the window exceeds the photo
		// and the gap shows on every side.
		const aspect = normalizedCropAspect(1, 1.5);
		expectRectClose(
			cropRectAroundBox({ x: 0, y: 0.0005, w: 0.3, h: 0.9 }, aspect, gap),
			cropRectAroundBox(FULL_CROP_RECT, aspect, gap),
		);
	});

	it('clamps the gap to the zoom-out limit and to zero', () => {
		const aspect = 16 / 9;
		const largestGap = cropRectAroundBox(FULL_CROP_RECT, aspect, 0.4);
		expectRectClose(
			largestGap,
			cropRectAroundBox(FULL_CROP_RECT, aspect, IMAGE_ZOOM_OUT_GAP_PER_SIDE),
		);
		// At the largest gap a whole-image box sits exactly at the editor's zoom-out floor.
		expect(cropRectToFocalZoom(largestGap).zoom).toBeCloseTo(zoomOutFloorForAspect(aspect), 10);
		// No gap: the whole image just fits, as at the contain zoom.
		expectRectClose(cropRectAroundBox(FULL_CROP_RECT, aspect, -0.1), containCropRect(aspect));
	});

	it('frames a wide product by its width when the width limits', () => {
		// A wide product in a 1500×1000 px photo on the 4:3 card: normalized aspect
		// (4/3) / 1.5 = 8/9. Width 0.8 beats 0.2 × 8/9, so the window is 0.8 / 0.85 wide
		// and 9/8 of that tall, centered on (0.5, 0.5). Zoom 0.85 × 8/9 / 0.8 ≈ 0.94 stays
		// above the 8/9 aspect's floor (8/9 × 0.7), x ≈ 0.029 lies within 0..1 - w and the
		// oversized height's y ≈ -0.029 within 1 - h..0, so nothing clamps.
		const aspect = normalizedCropAspect(4 / 3, 1.5);
		const box: ImageCropRect = { x: 0.1, y: 0.4, w: 0.8, h: 0.2 };
		const width = 0.8 / boxShare;
		const height = (9 / 8) * width;
		expectRectClose(cropRectAroundBox(box, aspect, gap), {
			x: 0.5 - width / 2,
			y: 0.5 - height / 2,
			w: width,
			h: height,
		});
	});

	it('frames a product touching only the bottom edge as spanning the whole image height', () => {
		// 1500×1000 px photo on the 1:1 thumb: normalized aspect 1 / 1.5 = 2/3. The bottom
		// edge (0.6 + 0.4 = 1) makes the vertical span 0..1, which limits (2/3 > 0.3): the
		// window is 1 / 0.85 tall, 2/3 of that wide, centered on (0.5, 0.5) with no clamp.
		const aspect = normalizedCropAspect(1, 1.5);
		const expected = {
			x: 0.5 - 1 / 3 / boxShare,
			y: 0.5 - 0.5 / boxShare,
			w: 2 / 3 / boxShare,
			h: 1 / boxShare,
		};
		expectRectClose(
			cropRectAroundBox({ x: 0.35, y: 0.6, w: 0.3, h: 0.4 }, aspect, gap),
			expected,
		);
		// 0.004 above the bottom edge is within the tolerance and still touches it.
		expectRectClose(
			cropRectAroundBox({ x: 0.35, y: 0.596, w: 0.3, h: 0.4 }, aspect, gap),
			expected,
		);
		// 0.01 above it does not: the product's width limits (0.3 > 0.4 × 2/3), the window
		// is 0.3 / 0.85 wide and 3/2 of that tall, and centering on y = 0.79 would overhang
		// the bottom, so the window rests on the image's bottom edge.
		expectRectClose(cropRectAroundBox({ x: 0.35, y: 0.59, w: 0.3, h: 0.4 }, aspect, gap), {
			x: 0.5 - 0.15 / boxShare,
			y: 1 - 0.45 / boxShare,
			w: 0.3 / boxShare,
			h: 0.45 / boxShare,
		});
	});

	it('frames a product touching only the right edge as spanning the whole image width', () => {
		// 1500×1000 px photo on the 1:1 thumb (normalized aspect 2/3). The right edge
		// (0.7 + 0.3 = 1) makes the horizontal span 0..1, which limits (1 > 0.1 × 2/3):
		// the window is 1 / 0.85 wide and 3/2 of that tall, centered on (0.5, 0.35). Both
		// sides are oversized and their origins lie within 1 - size..0, so nothing clamps.
		const aspect = normalizedCropAspect(1, 1.5);
		expectRectClose(cropRectAroundBox({ x: 0.7, y: 0.3, w: 0.3, h: 0.1 }, aspect, gap), {
			x: 0.5 - 0.5 / boxShare,
			y: 0.35 - 0.75 / boxShare,
			w: 1 / boxShare,
			h: 1.5 / boxShare,
		});
	});

	it('rests the window on the image edge for a product near but not touching it', () => {
		// A 0.3 × 0.3 product at x = 0.02 on a square photo's 1:1 thumb: the window is
		// 0.3 / 0.85 ≈ 0.353 square. Centered on x = 0.17 it would start at ≈ -0.006,
		// past the image, so the window keeps its size and starts at 0, leaving less
		// than the gap on the left (0.02 / 0.353 ≈ 5.7 %).
		expectRectClose(cropRectAroundBox({ x: 0.02, y: 0.35, w: 0.3, h: 0.3 }, 1, gap), {
			x: 0,
			y: 0.5 - 0.15 / boxShare,
			w: 0.3 / boxShare,
			h: 0.3 / boxShare,
		});
	});

	it('stops at the maximum zoom on a non-square aspect, centered on the product', () => {
		// A 0.05 product on the 4:3 card of a 1500×1000 px photo (normalized aspect 8/9)
		// would need zoom ≈ 15; at the maximum zoom 3 a tall-normalized window is 1/3 tall
		// and 8/9 of that wide, centered on (0.525, 0.525).
		const aspect = normalizedCropAspect(4 / 3, 1.5);
		const rect = cropRectAroundBox({ x: 0.5, y: 0.5, w: 0.05, h: 0.05 }, aspect, gap);
		expectRectClose(rect, {
			x: 0.525 - 4 / 27,
			y: 0.525 - 1 / 6,
			w: 8 / 27,
			h: 1 / 3,
		});
		expect(cropRectToFocalZoom(rect).zoom).toBeCloseTo(IMAGE_ZOOM_MAX, 10);
	});

	it('rejects a product box outside the image or without a positive size', () => {
		const invalidBoxes: ImageCropRect[] = [
			{ x: 0.9, y: 0, w: 0.3, h: 0.5 },
			{ x: -0.1, y: 0, w: 0.5, h: 0.5 },
			{ x: 0, y: 0.6, w: 0.5, h: 0.5 },
			{ x: 0.2, y: 0.2, w: 0, h: 0.5 },
			{ x: 0.2, y: 0.2, w: 0.5, h: -0.1 },
			{ x: Number.NaN, y: 0, w: 0.5, h: 0.5 },
		];
		for (const box of invalidBoxes) {
			expect(() => cropRectAroundBox(box, 1, gap)).toThrow(RangeError);
		}
	});
});

describe('framedGiftImageMeta', () => {
	it('persists a Manual cover-crop framing for both gift targets', () => {
		// A 600×800 px (3:4) box shot, whole image, 7.5 % gap, on white.
		const meta = framedGiftImageMeta({
			width: 600,
			height: 800,
			box: FULL_CROP_RECT,
			gapPerSide: 0.075,
			bgColor: '#ffffff',
		});
		const height = 1 / 0.85;
		expect(meta).toMatchObject({
			fitMode: 'cover-crop',
			bgColor: '#ffffff',
			cropRect: null,
			focal: { x: 50, y: 50 },
			zoom: 1,
		});
		const square = meta.targets?.square;
		const thumb = meta.targets?.thumb;
		if (square === undefined || thumb === undefined) {
			throw new Error('expected both gift targets');
		}
		// Card: normalized aspect 16/9 (see cropRectAroundBox); zoom binds the wider side.
		expectRectClose(square.cropRect, {
			x: 0.5 - ((16 / 9) * height) / 2,
			y: 0.5 - height / 2,
			w: (16 / 9) * height,
			h: height,
		});
		expect(square.zoom).toBeCloseTo(1 / ((16 / 9) * height), 10);
		expect(square.focal.x).toBeCloseTo(50, 10);
		expect(square.focal.y).toBeCloseTo(50, 10);
		// Thumb: normalized aspect 4/3.
		expectRectClose(thumb.cropRect, {
			x: 0.5 - ((4 / 3) * height) / 2,
			y: 0.5 - height / 2,
			w: (4 / 3) * height,
			h: height,
		});
		expect(thumb.zoom).toBeCloseTo(1 / ((4 / 3) * height), 10);
		expect(v.safeParse(ImageMetadataSchema, meta).success).toBe(true);
	});

	it('frames a product touching only the top edge of a landscape photo like the full image height, on both targets', () => {
		// The top edge makes the vertical span 0..1 in a 1500×1000 px photo. Card
		// (normalized aspect 8/9) and thumb (2/3) are both height-limited (aspect × 1 >
		// 0.2): the window is 1 / 0.85 tall, aspect × that wide, centered on (0.5, 0.5);
		// the card's oversized width and the thumb's x ≈ 0.108 both stay unclamped.
		const meta = framedGiftImageMeta({
			width: 1500,
			height: 1000,
			box: { x: 0.4, y: 0, w: 0.2, h: 0.3 },
			gapPerSide: 0.075,
			bgColor: '#ffffff',
		});
		const targetAspects = { square: 8 / 9, thumb: 2 / 3 } as const;
		for (const [target, aspect] of Object.entries(targetAspects)) {
			const window = meta.targets?.[target as keyof typeof targetAspects]?.cropRect;
			if (window === undefined) {
				throw new Error(`expected the ${target} target`);
			}
			expectRectClose(window, {
				x: 0.5 - aspect / 0.85 / 2,
				y: 0.5 - 1 / 0.85 / 2,
				w: aspect / 0.85,
				h: 1 / 0.85,
			});
		}
		expect(v.safeParse(ImageMetadataSchema, meta).success).toBe(true);
	});

	it('persists a max-zoom framing of a tiny product that the metadata schema accepts', () => {
		const meta = framedGiftImageMeta({
			width: 1500,
			height: 1000,
			box: { x: 0.5, y: 0.5, w: 0.05, h: 0.05 },
			bgColor: '#ffffff',
		});
		expect(meta.targets?.square?.zoom).toBeCloseTo(IMAGE_ZOOM_MAX, 10);
		expect(meta.targets?.thumb?.zoom).toBeCloseTo(IMAGE_ZOOM_MAX, 10);
		expect(v.safeParse(ImageMetadataSchema, meta).success).toBe(true);
	});

	it('uses the default gap when none is given', () => {
		const framing = {
			width: 1500,
			height: 1000,
			box: { x: 0.3, y: 0.25, w: 0.3, h: 0.5 },
			bgColor: '#ffffff',
		};
		expect(framedGiftImageMeta(framing)).toEqual(
			framedGiftImageMeta({ ...framing, gapPerSide: GIFT_FRAMING_DEFAULT_GAP_PER_SIDE }),
		);
	});

	it('rejects a non-positive or non-finite image size and an invalid box', () => {
		const framing = { width: 1500, height: 1000, box: FULL_CROP_RECT, bgColor: null };
		for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => framedGiftImageMeta({ ...framing, width: size })).toThrow(RangeError);
			expect(() => framedGiftImageMeta({ ...framing, height: size })).toThrow(RangeError);
		}
		expect(() =>
			framedGiftImageMeta({ ...framing, box: { x: 0.9, y: 0, w: 0.3, h: 0.5 } }),
		).toThrow(RangeError);
	});

	it('keeps a null background for the transparent mat', () => {
		const meta = framedGiftImageMeta({
			width: 1500,
			height: 1000,
			box: { x: 0.4, y: 0.35, w: 0.2, h: 0.3 },
			bgColor: null,
		});
		expect(meta.bgColor).toBeNull();
		expect(v.safeParse(ImageMetadataSchema, meta).success).toBe(true);
	});
});
