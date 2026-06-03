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
