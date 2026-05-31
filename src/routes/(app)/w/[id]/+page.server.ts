import type { PageServerLoad } from './$types.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';

export const load: PageServerLoad = async ({ params }) => {
	const [wishlistData, giftsData] = await Promise.all([
		getWishlistByShortId(params.id),
		getGiftsByWishlistShortId(params.id),
	]);

	return {
		wishlist: wishlistData,
		gifts: giftsData.gifts,
		role: giftsData.role,
	};
};
