import * as v from 'valibot';
import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { guardedCommand } from '$lib/server/remote.js';

export const shareWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
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
	if (row.status === 'archived') {
		error(400, 'Cannot share an archived wishlist');
	}
	if (row.sharedAt !== null) {
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
