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
	// Retired wide-card crop, retained for the legacy `targets.card` square fallback.
	card: {
		aspect: 356 / 128,
		cssAspect: '356 / 128',
		realWidth: 356,
		realHeight: 128,
		realSizeText: '356 × 128 px',
	},
	// Retired detail-modal crop (issue #183): the visitor detail view now renders
	// the full uncropped photo and is no longer a crop-target consumer. Kept
	// parseable for legacy `targets.detail` rows only.
	detail: {
		aspect: 403 / 806,
		cssAspect: '1 / 2',
		realWidth: 403,
		realHeight: 806,
		realSizeText: '403 × 806 px',
	},
	// The GiftCard grid uses this 4:3 family (issue #183, revises the 1:1 shape
	// #163 introduced). The name stays `square` because it is a stable
	// persisted `image_meta.targets` key (renaming would need a data migration,
	// which #183 explicitly avoids) — the SAME persisted focal+zoom reprojects
	// losslessly onto the wider window with no data change (focal+zoom is
	// resolution- and aspect-ratio-independent). The reservation/list thumbnail
	// no longer renders through this target: #189 gave it the dedicated 1:1
	// `thumb` target below (this key remains a 4:3 misnomer for card-family only).
	square: {
		aspect: 4 / 3,
		cssAspect: '4 / 3',
		realWidth: 356,
		realHeight: 267,
		realSizeText: '356 × 267 px',
	},
	// 1:1 list-thumbnail + reservation-thumb family (#189): the wishlist list row
	// and ReserveModal's small square icon are EXACT consumers of this target.
	thumb: {
		aspect: 1,
		cssAspect: '1 / 1',
		realWidth: 146,
		realHeight: 146,
		realSizeText: '146 × 146 px',
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
