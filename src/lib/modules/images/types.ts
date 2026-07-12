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

/** Zoom factor bounds for `cover-crop` (1 = 100%, 3 = 300%). */
export const IMAGE_ZOOM_MIN = 1;
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
 * `card` is the wide card banner, `detail` the tall detail-modal column,
 * `square` the 1:1 pair (list thumbnail + reservation modal).
 */
export const GIFT_CROP_TARGETS = {
	card: 'card',
	detail: 'detail',
	square: 'square',
} as const;

export type GiftCropTarget = (typeof GIFT_CROP_TARGETS)[keyof typeof GIFT_CROP_TARGETS];

export const GIFT_CROP_TARGET_VALUES = Object.values(GIFT_CROP_TARGETS);

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

const NormalizedSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const PercentSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(100));

const ImageCropRectSchema = v.object({
	x: NormalizedSchema,
	y: NormalizedSchema,
	w: NormalizedSchema,
	h: NormalizedSchema,
});

const ImageFocalPointSchema = v.object({
	x: PercentSchema,
	y: PercentSchema,
});

const ZoomSchema = v.pipe(v.number(), v.minValue(IMAGE_ZOOM_MIN), v.maxValue(IMAGE_ZOOM_MAX));

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
	zoom: IMAGE_ZOOM_MIN,
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
