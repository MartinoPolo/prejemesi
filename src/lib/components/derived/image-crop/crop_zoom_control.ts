import {
	IMAGE_ZOOM_MAX,
	cropRectToFocalZoom,
	zoomOutFloorForAspect,
	type ImageCropRect,
} from '$lib/modules/images/index.js';

/** Zoom change of one zoom button press or `+`/`−` key press. */
export const CROP_ZOOM_STEP = 0.1;

const ZOOM_LIMIT_TOLERANCE = 1e-3;

/** What a zoom slider with zoom-out and zoom-in buttons shows for a crop window. */
export interface CropZoomControl {
	zoom: number;
	/** Whole-percent slider value. */
	percent: number;
	minPercent: number;
	maxPercent: number;
	canZoomOut: boolean;
	canZoomIn: boolean;
}

/**
 * Slider state for a crop window at a normalized aspect. Set a zoom with
 * `zoomCropRect(rect, normalizedAspect, percent / 100)`, which keeps the window
 * centre in place.
 */
export function cropZoomControl(rect: ImageCropRect, normalizedAspect: number): CropZoomControl {
	const { zoom } = cropRectToFocalZoom(rect);
	const zoomOutFloor = zoomOutFloorForAspect(normalizedAspect);
	return {
		zoom,
		// Drops float noise first so a floor of 0.75 × 0.7 reads 53 %, not 52 %.
		percent: Math.round(Number((zoom * 100).toFixed(6))),
		// Whole-percent steps let the slider land on the floor itself (`zoomCropRect`
		// floors a value just below it), and never above a deeper inherited zoom, which
		// the native input would otherwise clamp up to its min.
		minPercent: Math.floor(Math.min(zoomOutFloor, zoom) * 100),
		maxPercent: IMAGE_ZOOM_MAX * 100,
		canZoomOut: zoom > zoomOutFloor + ZOOM_LIMIT_TOLERANCE,
		canZoomIn: zoom < IMAGE_ZOOM_MAX - ZOOM_LIMIT_TOLERANCE,
	};
}
