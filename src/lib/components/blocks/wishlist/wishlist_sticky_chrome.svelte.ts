import { getContext, setContext } from 'svelte';

const WISHLIST_STICKY_CHROME_KEY = Symbol('wishlist-sticky-chrome');

/**
 * The wishlist page's sticky chrome inside the app scroller: the toolbar publishes where its stuck
 * box ends, so strips that stick beneath it (the Carousel chip bar) line up with it, and each such
 * strip registers itself, so the toolbar stops fading out over it.
 */
export interface WishlistStickyChrome {
	/** CSS px from the scroller's top edge to the stuck toolbar's bottom edge. */
	toolbarBottom: number;
	/** Sticky strips currently rendered right below the toolbar. */
	stripsBelowToolbar: number;
}

export function setWishlistStickyChrome(): WishlistStickyChrome {
	const stickyChrome = $state<WishlistStickyChrome>({ toolbarBottom: 0, stripsBelowToolbar: 0 });
	setContext(WISHLIST_STICKY_CHROME_KEY, stickyChrome);
	return stickyChrome;
}

/** Undefined outside the wishlist page, where nothing sticks above the content. */
export function getWishlistStickyChrome(): WishlistStickyChrome | undefined {
	return getContext<WishlistStickyChrome | undefined>(WISHLIST_STICKY_CHROME_KEY);
}
