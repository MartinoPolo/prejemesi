import { getMyWishlists, getModeratedWishlists, getFollowedWishlists } from './wishlists.remote.js';

/**
 * Force-refresh the three dashboard list queries after a wishlist mutation so every
 * surface that reads them (the /my-lists, /moderated, /followed pages and the navbar
 * "recent" dropdowns) reflects the change without a full page reload.
 */
export async function refreshWishlistDashboards(): Promise<void> {
	await Promise.allSettled([
		getMyWishlists().refresh(),
		getModeratedWishlists().refresh(),
		getFollowedWishlists().refresh(),
	]);
}
