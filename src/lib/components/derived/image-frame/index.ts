export { default as ImageFrame } from './ImageFrame.svelte';
export {
	imageFrameVariants,
	type ImageFrameShape,
	type ImageFrameResolvedFit,
	IMAGE_FRAME_SHAPES,
	IMAGE_FRAME_FIT_MODES,
} from './image_frame_variants.js';
export {
	resolveAutoFit,
	resolveFrameFill,
	IMAGE_FIT_MODES,
	IMAGE_TOKEN_SCOPES,
	AUTO_CONTAIN_RATIO_THRESHOLD,
	type ImageFitMode,
	type ImageTokenScope,
	type ResolvedImageFit,
} from './image_frame_fit.js';
