import { asset } from '$app/paths';
import * as v from 'valibot';
import libraryManifest from './wishlist_background_library.json';
import { WISHLIST_THEME_IDS, type WishlistThemeId } from './wishlist_themes.js';

/**
 * The curated background library (#531): images generated offline per wishlist theme by
 * `scripts/generate_theme_backgrounds.mjs`, which also rewrites the manifest. Files live in
 * `static/wishlist-backgrounds/<id>-<width>.webp`.
 */
export const WISHLIST_LIBRARY_IMAGE_VARIANTS = ['illustrated', 'photo'] as const;

export type WishlistLibraryImageVariant = (typeof WISHLIST_LIBRARY_IMAGE_VARIANTS)[number];

const WishlistLibraryImageSchema = v.strictObject({
	id: v.pipe(v.string(), v.minLength(1)),
	themeId: v.picklist(WISHLIST_THEME_IDS),
	variant: v.picklist(WISHLIST_LIBRARY_IMAGE_VARIANTS),
	widths: v.pipe(
		v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
		v.nonEmpty(),
		v.check(
			(widths) => widths.every((width, index) => index === 0 || width > widths[index - 1]),
			'Library image widths must be ascending.',
		),
	),
});

export type WishlistLibraryImage = v.InferOutput<typeof WishlistLibraryImageSchema>;

/** Manifest order is theme order, so listing stays stable across regenerations. */
export const WISHLIST_LIBRARY_IMAGES: readonly WishlistLibraryImage[] = v.parse(
	v.array(WishlistLibraryImageSchema),
	libraryManifest,
);

export function findWishlistLibraryImage(id: string | null): WishlistLibraryImage | null {
	return WISHLIST_LIBRARY_IMAGES.find((image) => image.id === id) ?? null;
}

export function isWishlistLibraryImageId(value: unknown): value is string {
	return typeof value === 'string' && findWishlistLibraryImage(value) !== null;
}

/** The library with the given theme's images first, otherwise in theme order. */
export function wishlistLibraryImagesForTheme(
	themeId: WishlistThemeId | null,
): WishlistLibraryImage[] {
	return [
		...WISHLIST_LIBRARY_IMAGES.filter((image) => image.themeId === themeId),
		...WISHLIST_LIBRARY_IMAGES.filter((image) => image.themeId !== themeId),
	];
}

function wishlistLibraryImageUrl(image: WishlistLibraryImage, width: number): string {
	return asset(`/wishlist-backgrounds/${image.id}-${String(width)}.webp`);
}

/** The smallest generated width, for picker and focal-point previews. */
export function wishlistLibraryImageThumbnailUrl(image: WishlistLibraryImage): string {
	return wishlistLibraryImageUrl(image, image.widths[0]);
}

/** Every generated width as a `srcset`; `src` is the widest file for browsers without srcset. */
export function wishlistLibraryImageSource(image: WishlistLibraryImage): {
	src: string;
	srcset: string;
} {
	return {
		src: wishlistLibraryImageUrl(image, image.widths[image.widths.length - 1]),
		srcset: image.widths
			.map((width) => `${wishlistLibraryImageUrl(image, width)} ${String(width)}w`)
			.join(', '),
	};
}
