/** Viewer-owned dark-mode page background behind a wishlist, independent from palette and wishlist data. */
export const DARK_WISHLIST_BACKGROUNDS = ['wishlist', 'app', 'tint'] as const;

export type DarkWishlistBackground = (typeof DARK_WISHLIST_BACKGROUNDS)[number];

export const DEFAULT_DARK_WISHLIST_BACKGROUND: DarkWishlistBackground = 'app';
export const DARK_WISHLIST_BACKGROUND_COOKIE_NAME = 'app-dark-wishlist-background';
export const DARK_WISHLIST_BACKGROUND_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isDarkWishlistBackground(value: unknown): value is DarkWishlistBackground {
	return (
		typeof value === 'string' &&
		(DARK_WISHLIST_BACKGROUNDS as readonly string[]).includes(value)
	);
}
