/**
 * Pure conversion helpers between the crop editor's rectangle and the renderer's
 * focal-point + zoom contract (#34 ImageFrame honors `focal` + `zoom`, not a raw
 * crop rect). Since issue #116 every manual crop is drawn PER TARGET with the
 * rectangle locked to the target surface's aspect ratio, which makes the
 * focal+zoom round-trip lossless by construction (D5): the renderer's visible
 * window equals the drawn rectangle exactly. Kept framework-free so it is
 * unit-testable in isolation.
 *
 * Renderer geometry (cover-crop): `object-fit: cover` + `object-position: f%`
 * + `scale(zoom)` with `transform-origin: f%` shows a source window of
 * normalized size `w = 1/zoom` on the bounding axis, positioned at
 * `origin = f% * (1 - size)` per axis. All conversions below are exact
 * inverses of that mapping.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from './fit_modes.js';
import {
	IMAGE_ZOOM_MIN,
	IMAGE_ZOOM_MAX,
	type GiftCropTarget,
	type ImageCropRect,
	type ImageFocalPoint,
	type ImageMetadata,
} from './types.js';

const CENTERED_FOCAL: ImageFocalPoint = { x: 50, y: 50 };

/** Identity crop rectangle – the full image, no cropping applied. */
export const FULL_CROP_RECT: ImageCropRect = { x: 0, y: 0, w: 1, h: 1 };

function clampZoom(zoom: number): number {
	if (!Number.isFinite(zoom)) {
		return IMAGE_ZOOM_MIN;
	}
	return Math.min(Math.max(zoom, IMAGE_ZOOM_MIN), IMAGE_ZOOM_MAX);
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** Clamp a rect origin so the rect stays inside the unit square. */
const clampOrigin = (origin: number, size: number) =>
	Math.min(Math.max(origin, 0), Math.max(1 - size, 0));

/**
 * Aspect ratio of a crop rectangle in NORMALIZED (0..1) space for a target
 * surface. A rect whose pixel aspect equals the target's pixel aspect satisfies
 * `rect.w / rect.h = targetAspect / imageRatio` (both aspects are width/height
 * in pixels). Degenerate inputs fall back to a square normalized aspect.
 */
export function normalizedCropAspect(targetAspect: number, imageRatio: number): number {
	if (
		!Number.isFinite(targetAspect) ||
		!Number.isFinite(imageRatio) ||
		targetAspect <= 0 ||
		imageRatio <= 0
	) {
		return 1;
	}
	return targetAspect / imageRatio;
}

/**
 * Normalized rect size for a zoom level at a normalized aspect. Zoom binds the
 * axis the target does not fully cover, so `max(w, h) = 1 / zoom` always holds.
 */
function rectSizeForZoom(normalizedAspect: number, zoom: number): { w: number; h: number } {
	const z = clampZoom(zoom);
	return normalizedAspect >= 1
		? { w: 1 / z, h: 1 / (z * normalizedAspect) }
		: { w: normalizedAspect / z, h: 1 / z };
}

/**
 * The automatic default framing (D1/REQ-1): the largest centered window at the
 * target's aspect – identical to what a centered object-fit cover renders.
 */
export function centeredCropRect(normalizedAspect: number): ImageCropRect {
	const { w, h } = rectSizeForZoom(normalizedAspect, IMAGE_ZOOM_MIN);
	return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Translate a crop rect by a normalized delta, keeping it inside the image. */
export function panCropRect(rect: ImageCropRect, dx: number, dy: number): ImageCropRect {
	return {
		x: clampOrigin(rect.x + dx, rect.w),
		y: clampOrigin(rect.y + dy, rect.h),
		w: rect.w,
		h: rect.h,
	};
}

/** Resize a crop rect to a zoom level around its current center. */
export function zoomCropRect(
	rect: ImageCropRect,
	normalizedAspect: number,
	zoom: number,
): ImageCropRect {
	const { w, h } = rectSizeForZoom(normalizedAspect, zoom);
	const centerX = rect.x + rect.w / 2;
	const centerY = rect.y + rect.h / 2;
	return { x: clampOrigin(centerX - w / 2, w), y: clampOrigin(centerY - h / 2, h), w, h };
}

/**
 * Re-shape an arbitrary rect to a target's normalized aspect: keep its center,
 * cover its extent, then clamp to the unit square and the renderer's zoom
 * bounds. Used when restoring a crop persisted for a different aspect (legacy
 * data, or a source-image swap) so the editor starts from the closest honest
 * framing rather than a silently distorted one.
 */
export function fitCropRectToAspect(rect: ImageCropRect, normalizedAspect: number): ImageCropRect {
	if (rect.w <= 0 || rect.h <= 0 || normalizedAspect <= 0) {
		return centeredCropRect(normalizedAspect > 0 ? normalizedAspect : 1);
	}
	let w = Math.max(rect.w, rect.h * normalizedAspect);
	let h = w / normalizedAspect;
	// Shrink to fit the unit square, then grow to respect the renderer's max zoom.
	const shrink = Math.min(1, 1 / w, 1 / h);
	w *= shrink;
	h *= shrink;
	const grow = Math.max(1, 1 / (IMAGE_ZOOM_MAX * Math.max(w, h)));
	w = Math.min(w * grow, 1);
	h = Math.min(h * grow, 1);
	const centerX = rect.x + rect.w / 2;
	const centerY = rect.y + rect.h / 2;
	return { x: clampOrigin(centerX - w / 2, w), y: clampOrigin(centerY - h / 2, h), w, h };
}

/**
 * Convert a normalized crop rectangle (0..1) into the renderer's focal point
 * (0..100%) + zoom. Exact inverse of the cover-crop window mapping: per axis
 * the window origin is `focal% * (1 - size)`, so `focal = origin / (1 - size)`;
 * zoom binds the larger normalized side. Lossless when the rect matches the
 * consumer surface's aspect (guaranteed for rects drawn since #116).
 */
export function cropRectToFocalZoom(rect: ImageCropRect): {
	focal: ImageFocalPoint;
	zoom: number;
} {
	if (rect.w <= 0 || rect.h <= 0) {
		return { focal: { ...CENTERED_FOCAL }, zoom: IMAGE_ZOOM_MIN };
	}
	const focalCoord = (origin: number, size: number): number =>
		size >= 1 ? 50 : clamp01(origin / (1 - size)) * 100;
	const focal: ImageFocalPoint = {
		x: focalCoord(rect.x, rect.w),
		y: focalCoord(rect.y, rect.h),
	};
	const zoom = clampZoom(1 / Math.max(rect.w, rect.h));
	return { focal, zoom };
}

/**
 * Inverse of {@link cropRectToFocalZoom} for a given normalized aspect: the
 * source window a cover-crop surface of that aspect actually renders for a
 * persisted focal + zoom. Restores the editor's rect from new per-target
 * metadata losslessly, and yields the honest current framing for legacy
 * focal/zoom-only rows.
 */
export function focalZoomToWindowRect(
	focal: ImageFocalPoint,
	zoom: number,
	normalizedAspect: number,
): ImageCropRect {
	const { w, h } = rectSizeForZoom(normalizedAspect, zoom);
	return {
		x: clamp01(focal.x / 100) * (1 - w),
		y: clamp01(focal.y / 100) * (1 - h),
		w,
		h,
	};
}

/**
 * Assemble persistable {@link ImageMetadata} from an editor's fit mode + crop
 * rectangle, deriving the renderer's focal + zoom. Shared by the gift and wishlist
 * crop editors so the persisted shape stays identical across both surfaces.
 */
export function cropStateToImageMeta(
	fitMode: ImageFitMode,
	cropRect: ImageCropRect,
	bgColor: string | null = null,
): ImageMetadata {
	const { focal, zoom } = cropRectToFocalZoom(cropRect);
	return {
		fitMode,
		cropRect: { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h },
		focal,
		zoom,
		bgColor,
	};
}

/** Renderer-ready presentation props derived from persisted gift image metadata. */
export interface ImageFrameProps {
	fitMode: ImageFitMode;
	focal: ImageFocalPoint;
	zoom: number;
	fillColor: string | null;
}

/**
 * Map persisted {@link ImageMetadata} onto the props the shared ImageFrame renderer
 * consumes. Used by every gift image consumer (card, list item, detail modal,
 * reservation modal, and the editor previews) so presentation stays identical
 * across all surfaces. Null metadata yields the renderer defaults.
 */
export function imageMetaToFrameProps(meta: ImageMetadata | null): ImageFrameProps {
	if (meta === null) {
		return {
			fitMode: IMAGE_FIT_MODES.auto,
			focal: { ...CENTERED_FOCAL },
			zoom: IMAGE_ZOOM_MIN,
			fillColor: null,
		};
	}

	let focal: ImageFocalPoint;
	let zoom: number;
	if (meta.focal !== undefined && meta.zoom !== undefined) {
		focal = meta.focal;
		zoom = clampZoom(meta.zoom);
	} else if (meta.cropRect != null) {
		({ focal, zoom } = cropRectToFocalZoom(meta.cropRect));
	} else {
		focal = meta.focal ?? { ...CENTERED_FOCAL };
		zoom = clampZoom(meta.zoom ?? IMAGE_ZOOM_MIN);
	}

	return {
		fitMode: meta.fitMode,
		focal,
		zoom,
		fillColor: meta.bgColor ?? null,
	};
}

/**
 * Renderer props for one gift crop target (#116 D2): a manual per-target crop
 * overrides the automatic framing for that target only; without one the gift
 * renders exactly as before the per-target extension existed (REQ-8).
 */
export function giftTargetFrameProps(
	meta: ImageMetadata | null,
	target: GiftCropTarget,
): ImageFrameProps {
	const targetCrop = meta?.targets?.[target];
	if (meta != null && targetCrop !== undefined) {
		return {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: targetCrop.focal,
			zoom: clampZoom(targetCrop.zoom),
			fillColor: meta.bgColor ?? null,
		};
	}
	return imageMetaToFrameProps(meta);
}
