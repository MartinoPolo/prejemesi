import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand } from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { verifyManagerAccess } from '$lib/modules/wishlists/wishlist_access.js';

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

	return { shortId: wishlistRow.shortId, alreadyShared: false } as const;
});
