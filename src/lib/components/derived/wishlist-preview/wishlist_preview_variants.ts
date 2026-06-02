import { tv } from 'tailwind-variants';

/**
 * Stub variant set for the themed wishlist preview surface. Establishes the
 * `--wishlist-preview` / `--wishlist-icon` token contract + emoji fallback for
 * the wishlist card work (#36); the full preview card is built there.
 */
export const wishlistPreviewVariants = tv({
	slots: {
		root: 'flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg bg-wishlist-preview',
		icon: 'text-5xl leading-none text-wishlist-icon',
		label: 'text-sm font-medium text-wishlist-muted-fg',
	},
});
