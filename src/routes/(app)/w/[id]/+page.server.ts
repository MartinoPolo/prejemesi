import type { PageServerLoad } from './$types.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { getUserLikesForWishlist } from '$lib/modules/likes/likes.remote.js';
import { followWishlist } from '$lib/modules/wishlists/wishlists.remote.js';

export const load: PageServerLoad = async ({ params }) => {
	const [wishlistData, giftsData] = await Promise.all([
		getWishlistByShortId(params.id),
		getGiftsByWishlistShortId(params.id),
	]);

	// Fetch user likes and auto-follow in parallel (both are guarded, so they no-op for anon)
	let userLikedGiftIds: string[] = [];
	try {
		const [likedIds] = await Promise.allSettled([
			getUserLikesForWishlist(),
			// Auto-follow on first visit (no-op for owner or already following)
			followWishlist(wishlistData.id),
		]);

		if (likedIds.status === 'fulfilled') {
			userLikedGiftIds = likedIds.value;
		}
	} catch {
		// Unauthenticated users — no likes, no follow
	}

	return {
		wishlist: wishlistData,
		gifts: giftsData.gifts,
		role: giftsData.role,
		userLikedGiftIds,
		isAuthenticated: true,
	};
};
