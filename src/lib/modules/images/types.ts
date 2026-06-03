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

/** Image presentation metadata persisted alongside an image key/URL. */
export interface ImageMetadata {
	fitMode: ImageFitMode;
	cropRect?: ImageCropRect | null;
	focal?: ImageFocalPoint;
	zoom?: number;
	bgColor?: string | null;
}

const NormalizedSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1));
const PercentSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(100));

export const ImageCropRectSchema = v.object({
	x: NormalizedSchema,
	y: NormalizedSchema,
	w: NormalizedSchema,
	h: NormalizedSchema,
});

export const ImageFocalPointSchema = v.object({
	x: PercentSchema,
	y: PercentSchema,
});

export const ImageMetadataSchema = v.object({
	fitMode: v.picklist(IMAGE_FIT_MODE_VALUES),
	cropRect: v.optional(v.nullable(ImageCropRectSchema)),
	focal: v.optional(ImageFocalPointSchema),
	zoom: v.optional(v.pipe(v.number(), v.minValue(IMAGE_ZOOM_MIN), v.maxValue(IMAGE_ZOOM_MAX))),
	bgColor: v.optional(v.nullable(v.string())),
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
