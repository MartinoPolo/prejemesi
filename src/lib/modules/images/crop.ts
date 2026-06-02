/**
 * Pure conversion helpers between the editor's crop rectangle and the renderer's
 * focal-point + zoom contract (#34 ImageFrame honors `focal` + `zoom`, not a raw
 * crop rect). A single normalized crop is reused across every consumer slot — each
 * slot derives its own visible window from the shared focal/zoom via object-fit
 * cover, so one crop applies everywhere ("one crop, all slots"). Kept framework-free
 * so it is unit-testable in isolation.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from '$lib/components/derived/image-frame/index.js';
import {
	IMAGE_ZOOM_MIN,
	IMAGE_ZOOM_MAX,
	type ImageCropRect,
	type ImageFocalPoint,
	type ImageMetadata,
} from './types.js';

const CENTERED_FOCAL: ImageFocalPoint = { x: 50, y: 50 };

function clampZoom(zoom: number): number {
	if (!Number.isFinite(zoom)) {
		return IMAGE_ZOOM_MIN;
	}
	return Math.min(Math.max(zoom, IMAGE_ZOOM_MIN), IMAGE_ZOOM_MAX);
}

/**
 * Convert a normalized crop rectangle (0..1) into the renderer's focal point
 * (0..100%) + zoom factor. Zoom is derived from the longer side so the whole crop
 * region stays visible rather than being sliced further by a slot's aspect ratio.
 */
export function cropRectToFocalZoom(rect: ImageCropRect): {
	focal: ImageFocalPoint;
	zoom: number;
} {
	if (rect.w <= 0 || rect.h <= 0) {
		return { focal: { ...CENTERED_FOCAL }, zoom: IMAGE_ZOOM_MIN };
	}
	const focal: ImageFocalPoint = {
		x: (rect.x + rect.w / 2) * 100,
		y: (rect.y + rect.h / 2) * 100,
	};
	const zoom = clampZoom(1 / Math.max(rect.w, rect.h));
	return { focal, zoom };
}

/**
 * Inverse of {@link cropRectToFocalZoom}: rebuild a square crop rectangle from a
 * focal point + zoom so the crop canvas can restore a region when only focal/zoom
 * were persisted. The rect is clamped inside the image bounds.
 */
export function focalZoomToCropRect(focal: ImageFocalPoint, zoom: number): ImageCropRect {
	const z = clampZoom(zoom);
	const size = 1 / z;
	const maxOrigin = 1 - size;
	const clampOrigin = (center: number) => Math.min(Math.max(center - size / 2, 0), maxOrigin);
	return {
		x: clampOrigin(focal.x / 100),
		y: clampOrigin(focal.y / 100),
		w: size,
		h: size,
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
