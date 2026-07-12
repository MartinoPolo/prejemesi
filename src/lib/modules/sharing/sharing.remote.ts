import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { verifyManagerAccess } from '$lib/modules/wishlists/wishlist_access.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';

export const shareWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	// Any manager (linked recipient or správce) may share — full management rights (issue #99).
	const { wishlistRow } = await verifyManagerAccess(user.id, wishlistId);

	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_SHARE_ARCHIVED_WISHLIST);
	}
	if (wishlistRow.sharedAt !== null) {
		return { shortId: wishlistRow.shortId, alreadyShared: true } as const;
	}

	const now = new Date();
	await getDb()
		.update(wishlist)
		.set({
			sharedAt: now,
			status: 'active',
			updatedAt: now,
		})
		.where(eq(wishlist.id, wishlistId));

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
	// new shared status (and its grace-window anchor) in the same round trip.
	singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

	return { shortId: wishlistRow.shortId, alreadyShared: false } as const;
});
