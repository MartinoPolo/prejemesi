import * as v from 'valibot';
import { ImageMetadataSchema, type ImageMetadata } from '$lib/modules/images/types.js';

/** Most images one gift carries; the first is its cover. */
export const MAX_GIFT_IMAGES = 8;

/**
 * One image of a gift's ordered gallery. An uploaded image has a storage key (an agent upload has
 * no URL yet); a linked image has only a URL.
 */
export interface GiftImage {
	imageUrl: string | null;
	imageKey: string | null;
	imageMeta: ImageMetadata | null;
}

/** A gallery image as readers outside the app see it: the storage key resolved to its URL. */
export interface PublicGiftImage {
	imageUrl: string | null;
	imageMeta: ImageMetadata | null;
}

interface ImageSource {
	imageUrl?: string | null;
	imageKey?: string | null;
}

/** Whether the URL/key pair points at an image at all. */
export function hasImageSource(image: ImageSource): boolean {
	return (image.imageUrl ?? null) !== null || (image.imageKey ?? null) !== null;
}

const GiftImageSchema = v.pipe(
	v.object({
		imageUrl: v.optional(v.nullable(v.string()), null),
		imageKey: v.optional(v.nullable(v.string()), null),
		imageMeta: v.optional(v.nullable(ImageMetadataSchema), null),
	}),
	v.check((image) => hasImageSource(image), 'Each image needs an imageUrl or imageKey.'),
);

/** The complete ordered gallery; the first image is the cover. */
export const GiftImagesSchema = v.pipe(
	v.array(GiftImageSchema),
	v.maxLength(MAX_GIFT_IMAGES, `A gift has at most ${MAX_GIFT_IMAGES} images.`),
);

const NO_IMAGE: GiftImage = { imageUrl: null, imageKey: null, imageMeta: null };

/** The cover image fields a gift row mirrors; all null for a gift without images. */
export function giftCover(images: readonly GiftImage[]): GiftImage {
	return images[0] ?? NO_IMAGE;
}

/**
 * The gallery after replacing only its cover: later images stay, and a cover without an image
 * clears the whole gallery (a gift cannot have later images without a cover).
 */
export function galleryWithCover(images: readonly GiftImage[], cover: GiftImage): GiftImage[] {
	if (!hasImageSource(cover)) {
		return [];
	}
	return [cover, ...images.slice(1)];
}

/** Storage keys of a gallery, each once. */
export function galleryImageKeys(images: readonly GiftImage[]): string[] {
	return [
		...new Set(images.flatMap((image) => (image.imageKey === null ? [] : [image.imageKey]))),
	];
}

/** Keys the previous gallery stored that the next one no longer references. */
export function releasedImageKeys(
	previousImages: readonly GiftImage[],
	nextImages: readonly GiftImage[],
): string[] {
	const keptKeys = new Set(galleryImageKeys(nextImages));
	return galleryImageKeys(previousImages).filter((key) => !keptKeys.has(key));
}
