import { asset } from '$app/paths';
import * as v from 'valibot';
import libraryManifest from './wishlist_background_library.json';
import { WISHLIST_THEME_IDS, type WishlistThemeId } from './wishlist_themes.js';

/**
 * The curated background library (#531): images generated offline per wishlist theme by
 * `scripts/generate_theme_backgrounds.mjs`, which also rewrites the manifest. Each image has a
 * file per viewer mode (#600) in `static/wishlist-backgrounds/<id>-<mode>-<width>.webp`; the
 * manifest lists the widths of the modes it has.
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
	widthsByMode: v.pipe(
		v.strictObject({ light: v.optional(WidthsSchema), dark: v.optional(WidthsSchema) }),
		v.check(
			(widthsByMode) => widthsByMode.light !== undefined || widthsByMode.dark !== undefined,
			'A library image needs a file for at least one mode.',
		),
	),
});

export type WishlistLibraryImage = v.InferOutput<typeof WishlistLibraryImageSchema>;

/**
 * One file of a background photo. `shownIn` limits it to that viewer mode when the image has a
 * file per mode; null shows it in both.
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

/**
 * Without a dark file the light one shows in dark mode under the automatic dark-mode dim, like a
 * custom photo. A missing light file is not washed out: the dark one shows as it is.
 */
export function wishlistLibraryImageHasDarkFile(image: WishlistLibraryImage): boolean {
	return image.widthsByMode.dark !== undefined;
}

function wishlistLibraryImageUrl(
	image: WishlistLibraryImage,
	mode: WishlistLibraryImageMode,
	width: number,
): string {
	return asset(`/wishlist-backgrounds/${image.id}-${mode}-${String(width)}.webp`);
}

/** The modes the image has files for, with their widths; a lone file serves both modes. */
function modeFiles(image: WishlistLibraryImage) {
	const files = WISHLIST_LIBRARY_IMAGE_MODES.flatMap((mode) => {
		const widths = image.widthsByMode[mode];
		return widths === undefined ? [] : [{ mode, widths }];
	});
	return files.map(({ mode, widths }) => ({
		shownIn: files.length > 1 ? mode : null,
		mode,
		widths,
	}));
}

/** The smallest generated width per mode, for picker and focal-point previews. */
export function wishlistLibraryImageThumbnailLayers(
	image: WishlistLibraryImage,
): WishlistBackgroundPhotoLayer[] {
	return modeFiles(image).map(({ shownIn, mode, widths }) => ({
		shownIn,
		src: wishlistLibraryImageUrl(image, mode, widths[0]),
	}));
}

/** Every generated width per mode as a `srcset`; `src` is the widest file for browsers without srcset. */
export function wishlistLibraryImageLayers(
	image: WishlistLibraryImage,
): WishlistBackgroundPhotoLayer[] {
	return modeFiles(image).map(({ shownIn, mode, widths }) => ({
		shownIn,
		src: wishlistLibraryImageUrl(image, mode, widths[widths.length - 1]),
		srcset: widths
			.map((width) => `${wishlistLibraryImageUrl(image, mode, width)} ${String(width)}w`)
			.join(', '),
	}));
}
