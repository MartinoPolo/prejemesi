import type { PageServerLoad } from './$types.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';

export const load: PageServerLoad = async ({ params }) => {
	const wishlistData = await getWishlistByShortId(params.id);

	return {
		wishlist: wishlistData,
		token: params.token,
	};
};
