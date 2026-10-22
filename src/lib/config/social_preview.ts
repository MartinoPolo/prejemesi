import socialPreviewImagePath from '$lib/assets/social-preview.png';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '$lib/modules/images/variants.js';
import type { SocialPreviewImage } from '$lib/modules/images/wishlist_slots.js';
import { SITE_URL } from './site.js';

// Bundled rather than served from `static/`: the content-hashed file name changes whenever
// the image is regenerated, so link-preview caches keyed by image URL (Facebook, Messenger)
// cannot keep showing a superseded design. Regenerate with `pnpm social-preview:generate`.
export const SOCIAL_PREVIEW_IMAGE: SocialPreviewImage = {
	url: new URL(socialPreviewImagePath, SITE_URL).href,
	width: OG_IMAGE_WIDTH,
	height: OG_IMAGE_HEIGHT,
};
