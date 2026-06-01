import type { PageServerLoad } from './$types.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
import { followWishlist } from '$lib/modules/wishlists/wishlists.remote.js';

export const load: PageServerLoad = async ({ params, parent, depends }) => {
	depends('app:wishlist-data');
	const [parentData, wishlistData, giftsData] = await Promise.all([
		parent(),
		getWishlistByShortId(params.id),
		getGiftsByWishlistShortId(params.id),
	]);

	const isAuthenticated = parentData.user !== null;

	// Fetch user likes and auto-follow in parallel (both are guarded, so they no-op for anon)
	let userLikedGiftIds: string[] = [];
	if (isAuthenticated) {
		try {
			const [likedIds] = await Promise.allSettled([
				getUserLikesForWishlist(),
				followWishlist(wishlistData.id),
			]);

			if (likedIds.status === 'fulfilled') {
				userLikedGiftIds = likedIds.value;
			}
		} catch {
			// Guarded calls may still fail — ignore
		}
	}

	return {
		wishlist: wishlistData,
		gifts: giftsData.gifts,
		role: giftsData.role,
		userLikedGiftIds,
		isAuthenticated,
	};
};
