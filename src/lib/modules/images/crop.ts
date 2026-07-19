/**
 * Pure conversion helpers between the crop editor's rectangle and the renderer's
 * focal-point + zoom contract (#34 ImageFrame honors `focal` + `zoom`, not a raw
 * crop rect). Since issue #116 every manual crop is drawn PER TARGET with the
 * rectangle locked to the target surface's aspect ratio, which makes the
 * focal+zoom round-trip lossless by construction (D5): the renderer's visible
 * window equals the drawn rectangle exactly. Kept framework-free so it is
 * unit-testable in isolation.
 *
 * Renderer geometry (cover-crop): the visible source window has normalized size
 * `1/zoom` on the bounding axis and per-axis origin `f% * (1 - size)`. All
 * conversions below are exact inverses of that mapping. Since the #116 round-2
 * zoom-out the window may EXTEND PAST the image on one axis (size > 1, negative
 * origin): the overhang renders as letterbox fill. The invariant is
 * `min(w, h) <= 1` – the image always spans the window fully on at least one
 * axis, so fill never appears on both axes at once.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from './fit_modes.js';
import {
	IMAGE_ZOOM_BASE,
	IMAGE_ZOOM_OUT_MIN,
	IMAGE_ZOOM_MAX,
	GIFT_EDITOR_CROP_TARGET_VALUES,
	type GiftEditorCropTarget,
	type GiftCropTarget,
	type ImageCropRect,
	type ImageFocalPoint,
	type ImageMetadata,
	type ImageTargetCrop,
} from './types.js';

const CENTERED_FOCAL: ImageFocalPoint = { x: 50, y: 50 };

/** Identity crop rectangle – the full image, no cropping applied. */
export const FULL_CROP_RECT: ImageCropRect = { x: 0, y: 0, w: 1, h: 1 };

function clampZoom(zoom: number): number {
	if (!Number.isFinite(zoom)) {
		return IMAGE_ZOOM_BASE;
	}
	return Math.min(Math.max(zoom, IMAGE_ZOOM_OUT_MIN), IMAGE_ZOOM_MAX);
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Clamp a rect origin so the image always covers the window's shorter side:
 * a window inside the image (size <= 1) stays inside the unit square, while an
 * oversized window (size > 1, zoomed out) keeps the image inside ITSELF – the
 * origin may go negative down to `1 - size` but the image never leaves the window.
 */
const clampOrigin = (origin: number, size: number) =>
	Math.min(Math.max(origin, Math.min(0, 1 - size)), Math.max(1 - size, 0));

/**
 * The zoom that shows the ENTIRE image inside a window of the given normalized
 * aspect (white space on exactly one axis unless the aspects match). This is the
 * per-aspect zoom-out floor: below it white space would appear on both axes.
 */
export function containZoomForAspect(normalizedAspect: number): number {
	if (!Number.isFinite(normalizedAspect) || normalizedAspect <= 0) {
		return IMAGE_ZOOM_BASE;
	}
	return Math.max(1 / Math.max(normalizedAspect, 1 / normalizedAspect), IMAGE_ZOOM_OUT_MIN);
}

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
 * axis the target does not fully cover, so `max(w, h) = 1 / zoom` always holds;
 * zooms below 1 make that side exceed the image (letterboxed overhang).
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
	const { w, h } = rectSizeForZoom(normalizedAspect, IMAGE_ZOOM_BASE);
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

/**
 * Resize a crop rect to a zoom level around its current center. The zoom floor
 * is the aspect's contain zoom, so zooming out stops exactly when the whole
 * image is visible (never white space on both axes).
 */
export function zoomCropRect(
	rect: ImageCropRect,
	normalizedAspect: number,
	zoom: number,
): ImageCropRect {
	const flooredZoom = Math.max(zoom, containZoomForAspect(normalizedAspect));
	const { w, h } = rectSizeForZoom(normalizedAspect, flooredZoom);
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
	// Invariant min(w, h) <= 1: the image must span the window on at least one
	// axis (zoom-out letterboxes one axis only), then respect both zoom bounds.
	const shrinkToInvariant = Math.min(1, 1 / Math.min(w, h));
	w *= shrinkToInvariant;
	h *= shrinkToInvariant;
	const shrinkToZoomFloor = Math.min(1, 1 / (IMAGE_ZOOM_OUT_MIN * Math.max(w, h)));
	w *= shrinkToZoomFloor;
	h *= shrinkToZoomFloor;
	const growToMaxZoom = Math.max(1, 1 / (IMAGE_ZOOM_MAX * Math.max(w, h)));
	w *= growToMaxZoom;
	h *= growToMaxZoom;
	const centerX = rect.x + rect.w / 2;
	const centerY = rect.y + rect.h / 2;
	return { x: clampOrigin(centerX - w / 2, w), y: clampOrigin(centerY - h / 2, h), w, h };
}

/**
 * Convert a normalized crop rectangle into the renderer's focal point (0..100%)
 * + zoom. Exact inverse of the cover-crop window mapping: per axis the window
 * origin is `focal% * (1 - size)`, so `focal = origin / (1 - size)` – for an
 * oversized (zoomed-out) axis both terms are negative and the same formula
 * positions the image within the letterboxed window. Zoom binds the larger
 * normalized side. Lossless when the rect matches the consumer surface's aspect
 * (guaranteed for rects drawn since #116).
 */
export function cropRectToFocalZoom(rect: ImageCropRect): {
	focal: ImageFocalPoint;
	zoom: number;
} {
	if (rect.w <= 0 || rect.h <= 0) {
		return { focal: { ...CENTERED_FOCAL }, zoom: IMAGE_ZOOM_BASE };
	}
	// At size 1 the axis is fully spanned and every focal renders identically.
	const focalCoord = (origin: number, size: number): number =>
		Math.abs(1 - size) < 1e-9 ? 50 : clamp01(origin / (1 - size)) * 100;
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
 * Seed an editor's crop rectangle from a persisted (whole-image or per-target/
 * per-slot) crop, honoring priority: an exact per-target/slot `cropRect` first,
 * then a base-level `cropRect`, then – critically – the legacy `focal`/`zoom`
 * pair reconstructed via {@link focalZoomToWindowRect} at a square placeholder
 * aspect (the real target aspect isn't known until the source image is
 * measured; `ImageCropStage`'s mount effect re-shapes the seed to it via
 * {@link fitCropRectToAspect}, which preserves this rect's CENTER – so the
 * focal point survives even though this seed's extent is provisional). Only
 * when NONE of `cropRect`/`focal`/`zoom` are present (a never-cropped image)
 * does this fall back to {@link FULL_CROP_RECT} (issue #123: a legacy row
 * that HAS focal/zoom must never seed from the always-centered identity rect,
 * which silently discards the real focal point the moment the editor is
 * opened and saved).
 */
export function seedCropRectFromLegacyMeta(saved: {
	cropRect?: ImageCropRect | null;
	focal?: ImageFocalPoint;
	zoom?: number;
}): ImageCropRect {
	if (saved.cropRect != null) {
		return { ...saved.cropRect };
	}
	if (saved.focal !== undefined && saved.zoom !== undefined) {
		return focalZoomToWindowRect(saved.focal, saved.zoom, 1);
	}
	return { ...FULL_CROP_RECT };
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
			zoom: IMAGE_ZOOM_BASE,
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
		zoom = clampZoom(meta.zoom ?? IMAGE_ZOOM_BASE);
	}

	return {
		fitMode: meta.fitMode,
		focal,
		zoom,
		fillColor: meta.bgColor ?? null,
	};
}

/**
 * Resolve a gift crop target's stored crop, following the no-migration carry-over
 * chain: `square` falls back to the retired wide `card` crop (#163); the 1:1 `thumb`
 * falls back to the 4:3 `square` crop (#189). The same focal+zoom reprojects onto the
 * target's window at render time, so existing gifts get an immediate crop with no data
 * migration. Shared by the renderer (`giftTargetFrameProps`) and the editor seed
 * (`GiftDetailForm.initTargetRects`) so the two never desync.
 */
export function resolveGiftTargetCrop(
	targets: ImageMetadata['targets'] | undefined,
	target: GiftCropTarget,
): ImageTargetCrop | undefined {
	return (
		targets?.[target] ??
		(target === 'square' ? targets?.card : target === 'thumb' ? targets?.square : undefined)
	);
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
	// Manual crops only apply on a cover-crop base: Fit (contain-padded) must
	// letterbox both axes even when stale per-target crops linger in the metadata
	// (#116 follow-up – the editor drops them on save, this guards rows persisted
	// in between).
	const targetCrop =
		meta?.fitMode === IMAGE_FIT_MODES.coverCrop
			? resolveGiftTargetCrop(meta.targets, target)
			: undefined;
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

/**
 * Merge manual gift-target edits without destructively migrating untouched rows.
 * A newly saved square crop supersedes the legacy wide-card target, while an
 * edit to Detail alone preserves that fallback for existing square renderers.
 */
export function mergeGiftTargetCrops(
	existingTargets: ImageMetadata['targets'] | undefined,
	editedTargets: Partial<Record<GiftEditorCropTarget, ImageTargetCrop>>,
): ImageMetadata['targets'] {
	const mergedTargets = { ...existingTargets, ...editedTargets };
	if (editedTargets.square !== undefined) {
		delete mergedTargets.card;
	}
	return Object.keys(mergedTargets).length > 0 ? mergedTargets : undefined;
}

/**
 * Build the `targets` a Manual-mode gift image save should persist, from the
 * editor's per-target session rects (`GiftDetailForm.targetRects`).
 *
 * An untouched session (no manual edits this session) is a pure pass-through:
 * whatever was persisted before flows through `mergeGiftTargetCrops` verbatim
 * – no metadata rewrite for a gift the user never actually edited.
 *
 * Once the user makes ANY manual edit, every editor target is pinned
 * explicitly from ITS OWN current session rect, not just the target(s) the
 * user actually dragged/zoomed. Two reasons this matters together:
 * - Session independence: editing one target must never move another
 *   target's live preview tile. Both tiles render through the shared
 *   `resolveGiftTargetCrop` carry-over chain (`thumb` → `square` → `card`),
 *   so as long as only the edited target has an explicit `targets` entry,
 *   an untouched target with NO entry keeps re-resolving through that chain
 *   and visibly "follows" every edit to the target it falls back to.
 * - WYSIWYG: what a preview tile shows during the session is what a save
 *   must make the real surfaces render. An untouched target's session rect
 *   (seeded once at mount, and reshaped to the target's aspect by
 *   `ImageCropStage`'s snap effect – see `GiftDetailForm.initTargetRects`)
 *   IS exactly the framing its tile has been displaying, so pinning it there
 *   locks in that same framing and prevents the carry-over chain from
 *   retroactively re-framing it to the edited target's crop after save.
 *
 * The carry-over chain itself is untouched by this – it still gives a never-
 * edited LEGACY row (no `targets` at all) an immediate crop with no data
 * migration; this function only stops it from ALSO reaching across two
 * targets edited live in the same session.
 */
export function buildManualGiftTargets(
	sessionRects: Record<GiftEditorCropTarget, ImageCropRect>,
	hasSessionEdits: boolean,
	existingTargets: ImageMetadata['targets'] | undefined,
): ImageMetadata['targets'] {
	if (!hasSessionEdits) {
		return mergeGiftTargetCrops(existingTargets, {});
	}
	const pinnedTargets: Partial<Record<GiftEditorCropTarget, ImageTargetCrop>> = {};
	for (const target of GIFT_EDITOR_CROP_TARGET_VALUES) {
		const rect = sessionRects[target];
		const { focal, zoom } = cropRectToFocalZoom(rect);
		pinnedTargets[target] = { cropRect: { ...rect }, focal, zoom };
	}
	return mergeGiftTargetCrops(existingTargets, pinnedTargets);
}
