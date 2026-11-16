/**
 * Canonical image fit modes (REQ-1). Domain-owned and framework-free so that both
 * the persistence layer (`images/types.ts`, schema, validation) and the UI renderer
 * (`ImageFrame`) depend on the domain rather than the domain depending on a UI
 * component. The `ImageFrame` modules re-export these for component-side consumers.
 */
export const IMAGE_FIT_MODES = {
	auto: 'auto',
	containPadded: 'contain-padded',
	coverCrop: 'cover-crop',
} as const;

export type ImageFitMode = (typeof IMAGE_FIT_MODES)[keyof typeof IMAGE_FIT_MODES];

/** Concrete fit applied to the rendered image once `auto` has been resolved. */
export type ResolvedImageFit =
	| typeof IMAGE_FIT_MODES.containPadded
	| typeof IMAGE_FIT_MODES.coverCrop;

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
