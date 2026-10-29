import { clamp01, type ImageCropRect } from '$lib/modules/images/index.js';

/** Arrow-key steps as a fraction of the framed extent; Shift takes the larger step. */
export const KEYBOARD_PAN_FRACTION = 0.05;
export const KEYBOARD_PAN_FRACTION_LARGE = 0.25;

export interface StageBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface CropWindowBox extends StageBox {
	/** On-screen size relative to the surface's real CSS size (1 = true size). */
	scale: number;
}

/**
 * The crop window at the surface's real CSS size, centered in the stage. It
 * only shrinks (never grows) when the real size does not fit inside the
 * stage's padding, so what the user frames is what the surface shows.
 */
export function cropWindowBox(
	stage: { width: number; height: number },
	surface: { width: number; height: number },
	padding: number,
): CropWindowBox | null {
	const availableWidth = stage.width - 2 * padding;
	const availableHeight = stage.height - 2 * padding;
	if (availableWidth <= 0 || availableHeight <= 0 || surface.width <= 0 || surface.height <= 0) {
		return null;
	}
	const scale = Math.min(1, availableWidth / surface.width, availableHeight / surface.height);
	const width = surface.width * scale;
	const height = surface.height * scale;
	return {
		width,
		height,
		left: (stage.width - width) / 2,
		top: (stage.height - height) / 2,
		scale,
	};
}

/**
 * Where the whole photo sits behind the window so the normalized crop rect
 * lands exactly on the window: the rect's size maps to the window's size.
 */
export function photoBoxBehindWindow(rect: ImageCropRect, window: StageBox): StageBox {
	const width = window.width / rect.w;
	const height = window.height / rect.h;
	return {
		width,
		height,
		left: window.left - rect.x * width,
		top: window.top - rect.y * height,
	};
}

/** The part of the photo the window shows, clipped to the photo (for the navigator). */
export function visiblePhotoRegion(rect: ImageCropRect): ImageCropRect {
	const left = clamp01(rect.x);
	const top = clamp01(rect.y);
	return {
		x: left,
		y: top,
		w: clamp01(rect.x + rect.w) - left,
		h: clamp01(rect.y + rect.h) - top,
	};
}

/**
 * The window-relative fraction of a surface that stays visible when a frame
 * narrower than the surface shows a centered side-window of it, e.g. the mobile
 * List row showing a slice of the square `thumb` composition.
 */
export function centeredVisibleBand(visibleFraction: number): { from: number; to: number } {
	const visible = Math.min(Math.max(visibleFraction, 0), 1);
	return { from: (1 - visible) / 2, to: (1 + visible) / 2 };
}
