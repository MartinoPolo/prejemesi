import { describe, it, expect } from 'vitest';
import * as v from 'valibot';
import {
	containZoomForAspect,
	cropRectToFocalZoom,
	focalZoomToWindowRect,
	normalizedCropAspect,
	centeredCropRect,
	panCropRect,
	zoomCropRect,
	fitCropRectToAspect,
	imageMetaToFrameProps,
	giftTargetFrameProps,
	resolveGiftTargetCrop,
	mergeGiftTargetCrops,
	seedCropRectFromLegacyMeta,
	FULL_CROP_RECT,
	type ImageFrameProps,
} from './crop.js';
import {
	DEFAULT_IMAGE_METADATA,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	ImageMetadataSchema,
	IMAGE_ZOOM_MAX,
	IMAGE_ZOOM_OUT_MIN,
	type ImageCropRect,
} from './types.js';
import { GIFT_CROP_TARGET_SPECS } from './crop_targets.js';
import { IMAGE_FIT_MODES } from '$lib/components/derived/image-frame/index.js';

/** Assert two rects are equal within floating-point tolerance. */
function expectRectClose(actual: ImageCropRect, expected: ImageCropRect) {
	expect(actual.x).toBeCloseTo(expected.x, 10);
	expect(actual.y).toBeCloseTo(expected.y, 10);
	expect(actual.w).toBeCloseTo(expected.w, 10);
	expect(actual.h).toBeCloseTo(expected.h, 10);
}

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

	it('zooms out below 100 % but floors at the contain zoom (#116 round 2)', () => {
		const centered = centeredCropRect(2);
		// 80 % keeps the covered axis covered while the other overhangs.
		expectRectClose(zoomCropRect(centered, 2, 0.8), {
			x: -0.125,
			y: 0.1875,
			w: 1.25,
			h: 0.625,
		});
		// Requests below the contain zoom stop exactly at contain: whole image,
		// white space on one axis only.
		expectRectClose(zoomCropRect(centered, 2, 0.1), { x: -0.5, y: 0, w: 2, h: 1 });
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

	it('shrinks a window oversized on both axes back to the contain limit', () => {
		// White space on both axes is unrepresentable: min(w, h) must come back to 1.
		const oversized: ImageCropRect = { x: -1, y: -1, w: 3, h: 3 };
		expectRectClose(fitCropRectToAspect(oversized, 2), { x: -0.5, y: 0, w: 2, h: 1 });
	});

	it('falls back to the centered window for degenerate rects', () => {
		expectRectClose(
			fitCropRectToAspect({ x: 0, y: 0, w: 0, h: 0 }, 0.5),
			centeredCropRect(0.5),
		);
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

	it('passes a persisted zoom-out through unclamped (#116 round 2)', () => {
		const props = imageMetaToFrameProps({
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { x: 50, y: 50 },
			zoom: 0.8,
		});
		// A render-time floor of 1 would snap saved letterboxed crops back to cover.
		expect(props.zoom).toBe(0.8);
	});

	it('uses the default metadata without throwing', () => {
		const props = imageMetaToFrameProps(DEFAULT_IMAGE_METADATA);
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.auto);
		expect(props.focal).toEqual({ x: 50, y: 50 });
		expect(props.zoom).toBe(1);
		expect(props.fillColor).toBeNull();
	});
});

describe('resolveGiftTargetCrop (shared carry-over chain, #189)', () => {
	const crop = (zoom: number) => ({
		cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
		focal: { x: 20, y: 20 },
		zoom,
	});

	it("returns the target's own crop when present", () => {
		const targets = { square: crop(2), thumb: crop(3) };
		expect(resolveGiftTargetCrop(targets, 'thumb')).toBe(targets.thumb);
		expect(resolveGiftTargetCrop(targets, 'square')).toBe(targets.square);
	});

	it('falls back square→card and thumb→square without a data migration', () => {
		expect(resolveGiftTargetCrop({ card: crop(2) }, 'square')).toEqual(crop(2));
		expect(resolveGiftTargetCrop({ square: crop(2) }, 'thumb')).toEqual(crop(2));
	});

	it('returns undefined when neither the target nor its fallback exists', () => {
		expect(resolveGiftTargetCrop(undefined, 'thumb')).toBeUndefined();
		expect(resolveGiftTargetCrop({}, 'square')).toBeUndefined();
		// `card` has no fallback of its own.
		expect(resolveGiftTargetCrop({ thumb: crop(2) }, 'card')).toBeUndefined();
	});
});

describe('giftTargetFrameProps', () => {
	const baseMeta = {
		fitMode: IMAGE_FIT_MODES.auto,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor: '#123456',
	};

	it('renders legacy rows unchanged when no per-target crop exists (REQ-8)', () => {
		const expected: ImageFrameProps = imageMetaToFrameProps(baseMeta);
		expect(giftTargetFrameProps(baseMeta, 'card')).toEqual(expected);
		expect(giftTargetFrameProps(null, 'square')).toEqual(imageMetaToFrameProps(null));
	});

	it('overrides only the target that has a manual crop (D1)', () => {
		const cardRect: ImageCropRect = {
			x: 0,
			y: 0.2,
			w: 1,
			h: 1 / GIFT_CROP_TARGET_SPECS.card.aspect,
		};
		const { focal, zoom } = cropRectToFocalZoom(cardRect);
		// Manual crops require a cover-crop base since the #116 follow-up.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { card: { cropRect: cardRect, focal, zoom } },
		};
		const cardProps = giftTargetFrameProps(meta, 'card');
		expect(cardProps.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(cardProps.focal).toEqual(focal);
		expect(cardProps.zoom).toBe(zoom);
		expect(cardProps.fillColor).toBe('#123456');
		// The other targets keep the automatic framing.
		expect(giftTargetFrameProps(meta, 'detail')).toEqual(imageMetaToFrameProps(meta));
	});

	it('ignores stale per-target crops when the base mode is fit (#116 follow-up)', () => {
		// Fit must letterbox both axes even when manual crops linger in
		// the metadata; per-target crops only apply on a cover-crop base.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.containPadded,
			targets: {
				card: {
					cropRect: { x: 0, y: 0, w: 0.5, h: 0.5 },
					focal: { x: 0, y: 0 },
					zoom: 2,
				},
			},
		};
		const props = giftTargetFrameProps(meta, 'card');
		expect(props).toEqual(imageMetaToFrameProps(meta));
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.containPadded);
	});

	it('honours a cover-crop base with a manual target when zoom is one', () => {
		// A cover-crop base consults targets regardless of the base focal/zoom.
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: {
				square: {
					cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
					focal: { x: 20, y: 20 },
					zoom: 2,
				},
			},
		};
		expect(giftTargetFrameProps(meta, 'square').zoom).toBe(2);
	});

	it('uses a legacy card crop as a square-only fallback until a square crop exists (#163)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 1 / GIFT_CROP_TARGET_SPECS.card.aspect },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { card: legacyCardCrop },
		};

		// The card surface was replaced by the square family. Its legacy crop keeps
		// rendering only as the square fallback, never as a detail override.
		expect(giftTargetFrameProps(meta, 'square').focal).toEqual(legacyCardCrop.focal);
		expect(giftTargetFrameProps(meta, 'square').zoom).toBe(legacyCardCrop.zoom);
		expect(giftTargetFrameProps(meta, 'detail')).toEqual(imageMetaToFrameProps(meta));

		const squareCrop = {
			cropRect: { x: 0.2, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 50, y: 25 },
			zoom: 1.5,
		};
		const migratedMeta = { ...meta, targets: { ...meta.targets, square: squareCrop } };
		expect(giftTargetFrameProps(migratedMeta, 'square').focal).toEqual(squareCrop.focal);
		expect(giftTargetFrameProps(migratedMeta, 'square').zoom).toBe(squareCrop.zoom);
	});

	it('renders a manual thumb crop for the 1:1 thumb target (#189 REQ-1)', () => {
		const thumbCrop = {
			cropRect: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 30, y: 40 },
			zoom: 1.5,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { thumb: thumbCrop },
		};
		const props = giftTargetFrameProps(meta, 'thumb');
		expect(props.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(props.focal).toEqual(thumbCrop.focal);
		expect(props.zoom).toBe(thumbCrop.zoom);
	});

	it('carries a square crop over to the thumb target until a thumb crop exists (#189 REQ-3)', () => {
		const squareCrop = {
			cropRect: { x: 0.2, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 50, y: 25 },
			zoom: 1.5,
		};
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: { square: squareCrop },
		};
		// No thumb crop yet: the 1:1 thumb reads the square framing as its
		// render-time carry-over (no data migration), mirroring square→card.
		expect(giftTargetFrameProps(meta, 'thumb').focal).toEqual(squareCrop.focal);
		expect(giftTargetFrameProps(meta, 'thumb').zoom).toBe(squareCrop.zoom);

		const thumbCrop = {
			cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
			focal: { x: 20, y: 20 },
			zoom: 2,
		};
		const editedMeta = { ...meta, targets: { ...meta.targets, thumb: thumbCrop } };
		// An explicit thumb crop supersedes the square carry-over.
		expect(giftTargetFrameProps(editedMeta, 'thumb').focal).toEqual(thumbCrop.focal);
		expect(giftTargetFrameProps(editedMeta, 'thumb').zoom).toBe(thumbCrop.zoom);
	});

	it('falls back to the base framing for thumb when neither thumb nor square exists (#189)', () => {
		const meta = {
			...baseMeta,
			fitMode: IMAGE_FIT_MODES.coverCrop,
		};
		expect(giftTargetFrameProps(meta, 'thumb')).toEqual(imageMetaToFrameProps(meta));
	});
});

describe('mergeGiftTargetCrops', () => {
	it('replaces the legacy card target when a manual square crop is saved (#163)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const detailCrop = {
			cropRect: { x: 0.2, y: 0, w: 0.5, h: 1 },
			focal: { x: 40, y: 50 },
			zoom: 1,
		};
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};

		expect(
			mergeGiftTargetCrops(
				{ card: legacyCardCrop, detail: detailCrop },
				{ square: squareCrop },
			),
		).toEqual({ detail: detailCrop, square: squareCrop });
	});

	it('preserves a legacy card fallback when the (sole) square target is untouched this session', () => {
		// Issue #165 retired `detail` from the editor targets, so the only two
		// reachable `editedTargets` shapes are `{}` (nothing touched) and
		// `{ square }` (covered above) – there is no longer a third target whose
		// edit could leave the card fallback in place while adding its own entry.
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};

		expect(mergeGiftTargetCrops({ card: legacyCardCrop }, {})).toEqual({
			card: legacyCardCrop,
		});
	});

	it('preserves a thumb edit alongside an existing square target (#189)', () => {
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};
		const thumbCrop = {
			cropRect: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
			focal: { x: 40, y: 40 },
			zoom: 1 / 0.6,
		};
		// Editing only the thumb keeps the existing square target intact – both survive.
		expect(mergeGiftTargetCrops({ square: squareCrop }, { thumb: thumbCrop })).toEqual({
			square: squareCrop,
			thumb: thumbCrop,
		});
	});

	it('still drops the legacy card fallback when a square crop is edited beside a thumb (#189)', () => {
		const legacyCardCrop = {
			cropRect: { x: 0, y: 0.2, w: 1, h: 0.36 },
			focal: { x: 50, y: 31.25 },
			zoom: 1,
		};
		const squareCrop = {
			cropRect: { x: 0.15, y: 0.15, w: 0.7, h: 0.7 },
			focal: { x: 50, y: 50 },
			zoom: 1 / 0.7,
		};
		const thumbCrop = {
			cropRect: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
			focal: { x: 40, y: 40 },
			zoom: 1 / 0.6,
		};
		// Editing the square still supersedes the legacy card; the thumb rides along.
		expect(
			mergeGiftTargetCrops(
				{ card: legacyCardCrop },
				{ square: squareCrop, thumb: thumbCrop },
			),
		).toEqual({ square: squareCrop, thumb: thumbCrop });
	});
});

describe('thumb crop target spec + schema (#189)', () => {
	it('exposes the thumb target as a true 1:1 aspect (REQ-1)', () => {
		expect(GIFT_CROP_TARGET_SPECS.thumb.aspect).toBe(1);
	});

	it('accepts a persisted targets.thumb crop row', () => {
		const meta = {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			targets: {
				thumb: {
					cropRect: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
					focal: { x: 30, y: 40 },
					zoom: 1.5,
				},
			},
		};
		const parsed = v.parse(ImageMetadataSchema, meta);
		expect(parsed.targets?.thumb?.focal).toEqual({ x: 30, y: 40 });
	});
});

describe('gift crop editor targets', () => {
	it('offers the square (4:3 card) and thumb (1:1 list + reservation) targets (#189)', () => {
		// #165 retired `detail`, leaving only `square`; #189 adds the true 1:1
		// `thumb` target for the wishlist-list row + reservation thumb.
		expect(GIFT_EDITOR_CROP_TARGET_VALUES).toEqual(['square', 'thumb']);
	});
});
