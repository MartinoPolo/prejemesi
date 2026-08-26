/**
 * Pure presentation logic for the ImageFrame primitive: fit-mode resolution and
 * background-fill priority. Kept framework-free so it is unit-testable in isolation.
 * Fit modes are owned by the `images` domain module and re-exported here so the
 * component barrel keeps a single import surface.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from '$lib/modules/images/fit_modes.js';
import { focalZoomToWindowRect, normalizedCropAspect } from '$lib/modules/images/crop.js';
import type { ImageFocalPoint } from '$lib/modules/images/types.js';

export { IMAGE_FIT_MODES, type ImageFitMode };

/** Concrete fit applied to the rendered image once `auto` has been resolved. */
export type ResolvedImageFit =
	| typeof IMAGE_FIT_MODES.containPadded
	| typeof IMAGE_FIT_MODES.coverCrop;

/** Token source that scopes the tier-2 fill (REQ-3). */
export const IMAGE_TOKEN_SCOPES = {
	wishlist: 'wishlist',
	global: 'global',
} as const;

export type ImageTokenScope = (typeof IMAGE_TOKEN_SCOPES)[keyof typeof IMAGE_TOKEN_SCOPES];

export function hasExplicitFrameFill(fillColor: string | null | undefined): fillColor is string {
	return fillColor !== undefined && fillColor !== null && fillColor.trim() !== '';
}

/**
 * Aspect-ratio divergence beyond which `auto` switches from cover to contain.
 * An image is "extreme" when it is more than this many times wider or taller
 * (relative to the box) than the box itself, e.g. a 32:9 panorama in a 4:3 box.
 */
export const AUTO_CONTAIN_RATIO_THRESHOLD = 2;

/**
 * Resolve the `auto` fit mode for a concrete image/box pair (REQ-1).
 * Normal aspect ratios fill the box (`cover-crop`); extreme ratios are contained
 * so no important content is cropped away.
 *
 * @param imageRatio width / height of the image's natural dimensions
 * @param boxRatio width / height of the destination box
 */
export function resolveAutoFit(imageRatio: number, boxRatio: number): ResolvedImageFit {
	if (
		!Number.isFinite(imageRatio) ||
		!Number.isFinite(boxRatio) ||
		imageRatio <= 0 ||
		boxRatio <= 0
	) {
		return IMAGE_FIT_MODES.coverCrop;
	}
	const divergence = Math.max(imageRatio / boxRatio, boxRatio / imageRatio);
	return divergence > AUTO_CONTAIN_RATIO_THRESHOLD
		? IMAGE_FIT_MODES.containPadded
		: IMAGE_FIT_MODES.coverCrop;
}

/** Pixel geometry of an explicitly positioned image inside its frame box. */
export interface CoverWindowLayout {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Explicit pixel layout for a cover-crop frame whose zoom is below the 100 %
 * cover baseline (#116 round 2). CSS `object-fit: cover` clips the image to the
 * element box, so `scale(zoom < 1)` would shrink the already-cropped view with
 * fill on BOTH axes instead of revealing more of the image. Positioning the
 * image explicitly renders the true source window: the box letterboxes on
 * exactly one axis (the frame fill shows through) while the other stays covered.
 * Returns null until the box and the image's natural ratio are measured.
 */
export function coverWindowLayout(input: {
	focal: ImageFocalPoint;
	zoom: number;
	boxWidth: number;
	boxHeight: number;
	naturalRatio: number;
}): CoverWindowLayout | null {
	const { focal, zoom, boxWidth, boxHeight, naturalRatio } = input;
	if (boxWidth <= 0 || boxHeight <= 0 || !Number.isFinite(naturalRatio) || naturalRatio <= 0) {
		return null;
	}
	const rect = focalZoomToWindowRect(
		focal,
		zoom,
		normalizedCropAspect(boxWidth / boxHeight, naturalRatio),
	);
	if (rect.w <= 0) {
		return null;
	}
	const width = boxWidth / rect.w;
	const height = width / naturalRatio;
	// `0 -` (instead of unary minus) keeps a zero origin as +0 for exact equality.
	return { left: 0 - rect.x * width, top: 0 - rect.y * height, width, height };
}

/**
 * Resolve the background fill in strict priority order (REQ-3):
 *   1. extracted/manual image color (literal)
 *   2. wishlist image-frame token → wishlist surface
 *   3. global neutral surface
 *
 * Returns a CSS value suitable for assigning to the `--frame-fill` custom property.
 */
export function resolveFrameFill(options: {
	fillColor: string | null;
	tokenScope: ImageTokenScope;
}): string {
	const { fillColor, tokenScope } = options;
	if (hasExplicitFrameFill(fillColor)) {
		return fillColor;
	}
	if (tokenScope === IMAGE_TOKEN_SCOPES.wishlist) {
		// Palette tokens re-derive per subtree ([data-palette] wrapper), so the
		// wishlist scope resolves through the same semantic token as the global one.
		return 'var(--secondary)';
	}
	return 'var(--surface-2)';
}
