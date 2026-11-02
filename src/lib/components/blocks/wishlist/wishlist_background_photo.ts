import {
	wishlistLibraryImageHasDarkFile,
	type WishlistBackgroundPhotoLayer,
	type WishlistLibraryImage,
	type WishlistLibraryImageMode,
} from '$lib/theme/wishlist_background_library.js';

/** A custom upload or library image ready to paint. */
export interface WishlistBackgroundPhoto {
	layers: WishlistBackgroundPhotoLayer[];
	/** Gets the automatic dim in dark mode only, because it has no file of its own for dark mode. */
	dimsInDarkMode: boolean;
}

/** A custom upload is a single light file, so it always dims in dark mode. */
export function customBackgroundPhoto(
	layer: WishlistBackgroundPhotoLayer,
): WishlistBackgroundPhoto {
	return { layers: [layer], dimsInDarkMode: true };
}

/**
 * A light-only library image dims in dark mode like a custom upload; an image with a dark file,
 * a dark-only one included, shows as it is and is never washed out in light mode.
 */
export function libraryBackgroundPhoto(
	image: WishlistLibraryImage,
	layers: WishlistBackgroundPhotoLayer[],
): WishlistBackgroundPhoto {
	return { layers, dimsInDarkMode: !wishlistLibraryImageHasDarkFile(image) };
}

/** The file a viewer mode shows: its own when the photo has one per mode, otherwise the only one. */
export function backgroundPhotoLayerForMode(
	photo: WishlistBackgroundPhoto,
	mode: WishlistLibraryImageMode,
): WishlistBackgroundPhotoLayer {
	return photo.layers.find((layer) => layer.shownIn === mode) ?? photo.layers[0];
}

/**
 * Shows a background photo layer only in its viewer mode, with no script, so the right file paints
 * first. The `dark` variant follows `.dark` and `[data-light-scope]` (`src/app.css`), so forced-mode
 * previews pick their own file.
 */
export function backgroundPhotoLayerDisplayClass(layer: WishlistBackgroundPhotoLayer): string {
	if (layer.shownIn === 'light') {
		return 'block dark:hidden';
	}
	if (layer.shownIn === 'dark') {
		return 'hidden dark:block';
	}
	return 'block';
}

/**
 * Two layers load lazily: a lazy image hidden by its mode has no box, so the browser never fetches
 * the other mode's file.
 */
export function backgroundPhotoLayerLoading(
	layers: readonly WishlistBackgroundPhotoLayer[],
): 'lazy' | undefined {
	return layers.length > 1 ? 'lazy' : undefined;
}
