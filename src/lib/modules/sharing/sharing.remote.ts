import 'use server';

import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand } from '$lib/server/remote.js';

/**
 * Share a wishlist: sets sharedAt timestamp and status to 'active'.
 * Owner only. Returns the wishlist shortId for building the public URL.
 */
export const shareWishlist = guardedCommand(async ({ user }, wishlistId: string) => {
	const database = getDb();

	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, 'Wishlist not found');
	}
	if (row.ownerId !== user.id) {
		error(403, 'Not authorized');
	}
	if (row.sharedAt !== null) {
		// Already shared — return existing shortId
		return { shortId: row.shortId, alreadyShared: true } as const;
	}

	const now = new Date();
	await database
		.update(wishlist)
		.set({
			sharedAt: now,
			status: 'active',
			updatedAt: now,
		})
		.where(eq(wishlist.id, wishlistId));

	return { shortId: row.shortId, alreadyShared: false } as const;
});
