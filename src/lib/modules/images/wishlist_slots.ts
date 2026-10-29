/**
 * Wishlist per-slot image helpers (REQ-2). A single assigned wishlist image is
 * cropped independently per consumer slot (dashboard card banner, thumbnail
 * family, social preview – see `crop_targets.ts` for the aspect specs); each
 * slot persists its own {@link ImageMetadata}. These helpers are framework-free
 * so they stay unit-testable in isolation, mirroring the gift crop helpers in
 * `crop.ts`.
 */

import { imagePublicUrl } from './public_url.js';
import { imageMetaToFrameProps, type ImageFrameProps } from './crop.js';
import { WISHLIST_EDITOR_SLOTS } from './crop_targets.js';
import { fillImageMeta } from './editor_modes.js';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, socialCropImageUrl } from './variants.js';
import type { WishlistImageSlot, WishlistImageSlots, ImageFocalPoint } from './types.js';

/**
 * Resolve a wishlist image object key to a client-loadable URL. Production
 * serves straight from the R2 public domain (PUBLIC_R2_URL) so image bytes
 * never flow through the Worker; local dev falls back to the same-origin
 * upload API route. Returns null when no image is assigned.
 */
export function wishlistImageUrl(imageKey: string | null | undefined): string | null {
	if (imageKey == null || imageKey === '') {
		return null;
	}
	return imagePublicUrl(imageKey);
}

/**
 * Seed every editor-offered wishlist slot with the automatic centered Fill
 * metadata for a freshly assigned image, so each preview shows a framed result
 * the owner can refine. The orphan `banner` slot is not seeded (#116 D3) –
 * existing banner JSON is retained but no new banner metadata is created.
 */
export function createDefaultWishlistSlots(): WishlistImageSlots {
	const slots: WishlistImageSlots = {};
	for (const slot of WISHLIST_EDITOR_SLOTS) {
		// fillImageMeta returns independent objects, so editing one slot never
		// mutates another.
		slots[slot] = fillImageMeta();
	}
	return slots;
}

/**
 * Map a single slot's persisted metadata onto the props the shared ImageFrame
 * renderer consumes, falling back to renderer defaults when the slot is unset.
 * Used by every wishlist image consumer so presentation stays identical across
 * surfaces.
 */
export function wishlistSlotToFrameProps(
	slots: WishlistImageSlots | null | undefined,
	slot: WishlistImageSlot,
): ImageFrameProps {
	return imageMetaToFrameProps(slots?.[slot] ?? null);
}

/**
 * Resolves the focal point the `social` slot was cropped to, falling back to
 * the centered default when the owner never opened the crop editor for it.
 * Reuses {@link wishlistSlotToFrameProps} so this stays in lockstep with every
 * other slot consumer's fallback rule.
 */
export function socialSlotFocalPoint(
	slots: WishlistImageSlots | null | undefined,
): ImageFocalPoint {
	return wishlistSlotToFrameProps(slots, 'social').focal;
}

/** An Open Graph / Twitter card image; dimensions are known only for fixed-size renders. */
export interface SocialPreviewImage {
	url: string;
	width?: number;
	height?: number;
}

/**
 * Resolves the Open Graph / Twitter card image for a wishlist (issue #117): a
 * fixed 1200×630 crop of the assigned image honoring the `social` slot's saved
 * focal point, or the caller's branded fallback when no image is assigned. When
 * the image cannot be transformed the original is served without dimensions,
 * because declaring 1200×630 for an arbitrary photo would misinform crawlers.
 */
export function wishlistSocialImage(
	imageKey: string | null | undefined,
	slots: WishlistImageSlots | null | undefined,
	fallbackImage: SocialPreviewImage,
): SocialPreviewImage {
	const imagePath = wishlistImageUrl(imageKey);
	if (imagePath === null) {
		return fallbackImage;
	}
	const croppedUrl = socialCropImageUrl(imagePath, socialSlotFocalPoint(slots));
	if (croppedUrl === null || croppedUrl === imagePath) {
		return { url: imagePath };
	}
	return { url: croppedUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
}
