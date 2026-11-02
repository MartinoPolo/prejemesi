import { asset } from '$app/paths';
import * as v from 'valibot';
import libraryManifest from './wishlist_background_library.json';
import { WISHLIST_THEME_IDS, type WishlistThemeId } from './wishlist_themes.js';

/**
 * The curated background library (#531): images generated offline per wishlist theme by
 * `scripts/generate_theme_backgrounds.mjs`, which also rewrites the manifest. Each image has a
 * file per viewer mode in `static/wishlist-backgrounds/<id>-<mode>-<width>.webp`; the
 * manifest lists the widths of both modes.
 */
export const WISHLIST_LIBRARY_IMAGE_VARIANTS = ['illustrated', 'photo'] as const;

export type WishlistLibraryImageVariant = (typeof WISHLIST_LIBRARY_IMAGE_VARIANTS)[number];

export const WISHLIST_LIBRARY_IMAGE_MODES = ['light', 'dark'] as const;

export type WishlistLibraryImageMode = (typeof WISHLIST_LIBRARY_IMAGE_MODES)[number];

const WidthsSchema = v.pipe(
	v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
	v.nonEmpty(),
	v.check(
		(widths) => widths.every((width, index) => index === 0 || width > widths[index - 1]),
		'Library image widths must be ascending.',
	),
);

const WishlistLibraryImageSchema = v.strictObject({
	id: v.pipe(v.string(), v.minLength(1)),
	themeId: v.picklist(WISHLIST_THEME_IDS),
	variant: v.picklist(WISHLIST_LIBRARY_IMAGE_VARIANTS),
	widthsByMode: v.strictObject({ light: WidthsSchema, dark: WidthsSchema }),
});

export type WishlistLibraryImage = v.InferOutput<typeof WishlistLibraryImageSchema>;

/**
 * One file of a background photo. `shownIn` limits it to that viewer mode, as for every library
 * image; null shows it in both, as for a custom photo.
 */
export interface WishlistBackgroundPhotoLayer {
	shownIn: WishlistLibraryImageMode | null;
	src: string;
	srcset?: string;
}

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

function wishlistLibraryImageUrl(
	image: WishlistLibraryImage,
	mode: WishlistLibraryImageMode,
	width: number,
): string {
	return asset(`/wishlist-backgrounds/${image.id}-${mode}-${String(width)}.webp`);
}

/** The smallest generated width per mode, for picker and focal-point previews. */
export function wishlistLibraryImageThumbnailLayers(
	image: WishlistLibraryImage,
): WishlistBackgroundPhotoLayer[] {
	return WISHLIST_LIBRARY_IMAGE_MODES.map((mode) => ({
		shownIn: mode,
		src: wishlistLibraryImageUrl(image, mode, image.widthsByMode[mode][0]),
	}));
}

/** Every generated width per mode as a `srcset`; `src` is the widest file for browsers without srcset. */
export function wishlistLibraryImageLayers(
	image: WishlistLibraryImage,
): WishlistBackgroundPhotoLayer[] {
	return WISHLIST_LIBRARY_IMAGE_MODES.map((mode) => {
		const widths = image.widthsByMode[mode];
		return {
			shownIn: mode,
			src: wishlistLibraryImageUrl(image, mode, widths[widths.length - 1]),
			srcset: widths
				.map((width) => `${wishlistLibraryImageUrl(image, mode, width)} ${String(width)}w`)
				.join(', '),
		};
	});
}
