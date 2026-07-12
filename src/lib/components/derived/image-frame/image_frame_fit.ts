/**
 * Pure presentation logic for the ImageFrame primitive: fit-mode resolution and
 * background-fill priority. Kept framework-free so it is unit-testable in isolation.
 * Fit modes are owned by the `images` domain module and re-exported here so the
 * component barrel keeps a single import surface.
 */

import { IMAGE_FIT_MODES, type ImageFitMode } from '$lib/modules/images/fit_modes.js';

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
	if (fillColor !== null && fillColor.trim() !== '') {
		return fillColor;
	}
	if (tokenScope === IMAGE_TOKEN_SCOPES.wishlist) {
		// Palette tokens re-derive per subtree ([data-palette] wrapper), so the
		// wishlist scope resolves through the same semantic token as the global one.
		return 'var(--secondary)';
	}
	return 'var(--surface-2)';
}
