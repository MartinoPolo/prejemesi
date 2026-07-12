/**
 * Wishlist per-slot image helpers (REQ-2). A single assigned wishlist image is
 * cropped independently per consumer slot (dashboard card banner, thumbnail
 * family, social preview – see `crop_targets.ts` for the aspect specs); each
 * slot persists its own {@link ImageMetadata}. These helpers are framework-free
 * so they stay unit-testable in isolation, mirroring the gift crop helpers in
 * `crop.ts`.
 */

import { imagePublicUrl } from './public_url.js';
import { IMAGE_FIT_MODES } from './fit_modes.js';
import { imageMetaToFrameProps, type ImageFrameProps } from './crop.js';
import { WISHLIST_EDITOR_SLOTS } from './crop_targets.js';
import {
	DEFAULT_IMAGE_METADATA,
	type WishlistImageSlot,
	type WishlistImageSlots,
} from './types.js';

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
 * Seed every editor-offered wishlist slot with centered cover-crop metadata for
 * a freshly assigned image, so each preview shows a framed result the owner can
 * refine. The orphan `banner` slot is not seeded (#116 D3) – existing banner
 * JSON is retained but no new banner metadata is created.
 */
export function createDefaultWishlistSlots(): WishlistImageSlots {
	const slots: WishlistImageSlots = {};
	for (const slot of WISHLIST_EDITOR_SLOTS) {
		// Each slot gets independent objects so editing one never mutates another.
		slots[slot] = {
			...DEFAULT_IMAGE_METADATA,
			fitMode: IMAGE_FIT_MODES.coverCrop,
			focal: { ...DEFAULT_IMAGE_METADATA.focal },
		};
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
