/**
 * Single source of truth for crop-target aspect data (#116 REQ-6): the editor
 * stage, the preview tiles, and the e2e aspect assertions all read the same
 * specs, so the editor can never drift from what the real surfaces render.
 *
 * `realWidth`/`realHeight` are the surface's rendered CSS pixels at the 1280px
 * reference viewport (runtime-measured in the #116 QA session); fluid-width
 * surfaces (gift card, dashboard banner) vary slightly with viewport width,
 * which is why aspect assertions use a tolerance.
 */

import { WISHLIST_IMAGE_SLOTS, type GiftCropTarget } from './types.js';

export interface CropTargetSpec {
	/** Pixel aspect ratio (width / height) the surface renders at. */
	aspect: number;
	/** Same ratio as a CSS `aspect-ratio` value for preview boxes. */
	cssAspect: string;
	/** Reference rendered size in CSS pixels (1280px viewport). */
	realWidth: number;
	realHeight: number;
	/** Human-readable real-size hint shown on the crop stage window. */
	realSizeText: string;
}

/** Gift crop targets (D2), grouped by aspect family. */
export const GIFT_CROP_TARGET_SPECS = {
	// GiftCard imageArea: h-32 fixed, fluid width (~356px in the wishlist grid @1280).
	card: {
		aspect: 356 / 128,
		cssAspect: '356 / 128',
		realWidth: 356,
		realHeight: 128,
		realSizeText: '356 × 128 px',
	},
	// GiftDetailForm image column: 45% of the 900px modal, height driven by the form.
	detail: {
		aspect: 403 / 806,
		cssAspect: '1 / 2',
		realWidth: 403,
		realHeight: 806,
		realSizeText: '403 × 806 px',
	},
	// GiftListItem size-16 (64px) + ReserveModal size-12 (48px) share the 1:1 family.
	square: {
		aspect: 1,
		cssAspect: '1 / 1',
		realWidth: 64,
		realHeight: 64,
		realSizeText: '64 × 64 px / 48 × 48 px',
	},
} as const satisfies Record<GiftCropTarget, CropTargetSpec>;

/**
 * Wishlist slots offered by the crop editor (D3: the orphan `banner` slot is
 * removed from the editor; its persisted JSON is retained untouched).
 */
export const WISHLIST_EDITOR_SLOTS = [
	WISHLIST_IMAGE_SLOTS.card,
	WISHLIST_IMAGE_SLOTS.thumbnail,
	WISHLIST_IMAGE_SLOTS.social,
] as const;

export type WishlistEditorSlot = (typeof WISHLIST_EDITOR_SLOTS)[number];

/** Wishlist editor slot specs; each slot is single-consumer after D3/D4. */
export const WISHLIST_SLOT_SPECS = {
	// WishlistCard banner: h-32 fixed, fluid width (~364px in the dashboard grid @1280).
	card: {
		aspect: 364 / 128,
		cssAspect: '364 / 128',
		realWidth: 364,
		realHeight: 128,
		realSizeText: '364 × 128 px',
	},
	// Header polaroid (D4, ~146px) + nav dropdown (34px) + list row (44px) 1:1 family.
	thumbnail: {
		aspect: 1,
		cssAspect: '1 / 1',
		realWidth: 146,
		realHeight: 146,
		realSizeText: '146 × 146 px',
	},
	// Open Graph preview image (rendered by social platforms at 1.91:1).
	social: {
		aspect: 1200 / 630,
		cssAspect: '1200 / 630',
		realWidth: 1200,
		realHeight: 630,
		realSizeText: '1200 × 630 px',
	},
} as const satisfies Record<WishlistEditorSlot, CropTargetSpec>;
