import * as v from 'valibot';
import { IMAGE_FIT_MODES, type ImageFitMode } from './fit_modes.js';

export { IMAGE_FIT_MODES, type ImageFitMode };

/**
 * Persisted image presentation metadata shared by gift images (REQ-1) and
 * per-slot wishlist images (REQ-2). Values are normalized (0..1 crop, 0..100
 * focal percent) rather than source pixels so they survive any source rescale.
 * The fit modes mirror the #34 ImageFrame renderer contract exactly so a
 * persisted value can be passed straight to the renderer.
 */

/** All selectable fit modes (mirrors the #34 renderer). */
export const IMAGE_FIT_MODE_VALUES = [
	IMAGE_FIT_MODES.auto,
	IMAGE_FIT_MODES.containPadded,
	IMAGE_FIT_MODES.coverCrop,
] as const satisfies readonly ImageFitMode[];

/**
 * Zoom factor range for `cover-crop` (1 = 100 % cover baseline, 3 = 300 %).
 * Zooming OUT below the baseline (#116 round 2) letterboxes the image inside
 * the target window on ONE axis; the per-aspect floor is the contain zoom
 * (`containZoomForAspect`), and `IMAGE_ZOOM_OUT_MIN` is the absolute floor that
 * keeps degenerate aspect pairs (≥20× divergence) from persisting useless zooms.
 */
export const IMAGE_ZOOM_BASE = 1;
export const IMAGE_ZOOM_OUT_MIN = 0.05;
export const IMAGE_ZOOM_MAX = 3;

/** Normalized crop rectangle in 0..1 space (origin + size). */
export interface ImageCropRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Focal point as a percentage (0..100), matching the renderer's object-position. */
export interface ImageFocalPoint {
	x: number;
	y: number;
}

/**
 * Gift crop targets (#116 D2): consumer surfaces grouped by aspect family.
 * `card` is the retired wide-card target retained only to read legacy rows,
 * `detail` the tall detail-modal column, and `square` the 1:1 card/list/
 * reservation family.
 */
export const GIFT_CROP_TARGETS = {
	card: 'card',
	detail: 'detail',
	square: 'square',
} as const;

export type GiftCropTarget = (typeof GIFT_CROP_TARGETS)[keyof typeof GIFT_CROP_TARGETS];

export const GIFT_CROP_TARGET_VALUES = Object.values(GIFT_CROP_TARGETS);

/**
 * Targets offered by the gift editor. `card` remains parseable legacy metadata
 * only; `detail` was retired the same way when the visitor detail modal moved
 * to the `square` crop (issue #165) — its persisted `targets.detail` rows stay
 * parseable, but the editor no longer offers it and no surface renders it.
 */
export const GIFT_EDITOR_CROP_TARGETS = {
	square: GIFT_CROP_TARGETS.square,
} as const;

export type GiftEditorCropTarget =
	(typeof GIFT_EDITOR_CROP_TARGETS)[keyof typeof GIFT_EDITOR_CROP_TARGETS];

export const GIFT_EDITOR_CROP_TARGET_VALUES = Object.values(GIFT_EDITOR_CROP_TARGETS);

/**
 * A manual per-target crop (#116 D1/D2): always cover-crop geometry whose rect
 * matches the target's aspect, making the focal+zoom render lossless (D5).
 */
export interface ImageTargetCrop {
	cropRect: ImageCropRect;
	focal: ImageFocalPoint;
	zoom: number;
}

/** Image presentation metadata persisted alongside an image key/URL. */
export interface ImageMetadata {
	fitMode: ImageFitMode;
	cropRect?: ImageCropRect | null;
	focal?: ImageFocalPoint;
	zoom?: number;
	bgColor?: string | null;
	/**
	 * Per-target manual crop overrides (#116 REQ-8, additive extension). A target
	 * without an entry keeps the automatic framing; rows persisted before #116
	 * simply have no `targets` and render exactly as before.
	 */
	targets?: Partial<Record<GiftCropTarget, ImageTargetCrop>>;
}

const PercentSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(100));

// A zoomed-out window may extend past the image on one axis (#116 round 2):
// its size grows up to 1/IMAGE_ZOOM_OUT_MIN and its origin goes negative down
// to `1 - size`. The editors keep `min(w, h) <= 1`; the schema only bounds the
// per-field ranges.
const MAX_RECT_SIZE = 1 / IMAGE_ZOOM_OUT_MIN;
const RectOriginSchema = v.pipe(v.number(), v.minValue(1 - MAX_RECT_SIZE), v.maxValue(1));
const RectSizeSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(MAX_RECT_SIZE));

const ImageCropRectSchema = v.object({
	x: RectOriginSchema,
	y: RectOriginSchema,
	w: RectSizeSchema,
	h: RectSizeSchema,
});

const ImageFocalPointSchema = v.object({
	x: PercentSchema,
	y: PercentSchema,
});

const ZoomSchema = v.pipe(v.number(), v.minValue(IMAGE_ZOOM_OUT_MIN), v.maxValue(IMAGE_ZOOM_MAX));

const ImageTargetCropSchema = v.object({
	cropRect: ImageCropRectSchema,
	focal: ImageFocalPointSchema,
	zoom: ZoomSchema,
});

export const ImageMetadataSchema = v.object({
	fitMode: v.picklist(IMAGE_FIT_MODE_VALUES),
	cropRect: v.optional(v.nullable(ImageCropRectSchema)),
	focal: v.optional(ImageFocalPointSchema),
	zoom: v.optional(ZoomSchema),
	bgColor: v.optional(v.nullable(v.string())),
	targets: v.optional(
		v.object({
			card: v.optional(ImageTargetCropSchema),
			detail: v.optional(ImageTargetCropSchema),
			square: v.optional(ImageTargetCropSchema),
		}),
	),
});

/** Default metadata applied to a freshly assigned image. */
export const DEFAULT_IMAGE_METADATA = {
	fitMode: IMAGE_FIT_MODES.auto,
	cropRect: null,
	focal: { x: 50, y: 50 },
	zoom: IMAGE_ZOOM_BASE,
	bgColor: null,
} as const satisfies ImageMetadata;

/**
 * Wishlist image slots (REQ-2). A single wishlist image is cropped per slot;
 * each context (card grid, dashboard thumbnail, page banner, social preview)
 * derives its own window from the shared source via per-slot metadata.
 */
export const WISHLIST_IMAGE_SLOTS = {
	card: 'card',
	thumbnail: 'thumbnail',
	banner: 'banner',
	social: 'social',
} as const;

export type WishlistImageSlot = (typeof WISHLIST_IMAGE_SLOTS)[keyof typeof WISHLIST_IMAGE_SLOTS];

export const WISHLIST_IMAGE_SLOT_VALUES = Object.values(WISHLIST_IMAGE_SLOTS);

/** Per-slot crop metadata; slots are optional so they can be set independently. */
export type WishlistImageSlots = Partial<Record<WishlistImageSlot, ImageMetadata>>;

export const WishlistImageSlotsSchema = v.object({
	card: v.optional(ImageMetadataSchema),
	thumbnail: v.optional(ImageMetadataSchema),
	banner: v.optional(ImageMetadataSchema),
	social: v.optional(ImageMetadataSchema),
});
