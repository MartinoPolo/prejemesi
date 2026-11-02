import type { WishlistBackgroundPhotoLayer } from '$lib/theme/wishlist_background_library.js';

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
