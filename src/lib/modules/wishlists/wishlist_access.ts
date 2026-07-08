import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import type { WishlistRole } from './types.js';

/**
 * Derive the caller's role from an already-fetched wishlist row.
 * Does NOT throw – returns 'visitor' when authContext is null or the user
 * has no elevated access. Use for read-only queries that need role information.
 */
export async function resolveWishlistRole(
	authContext: { user: { id: string } } | null,
	wishlistRow: typeof wishlist.$inferSelect,
): Promise<WishlistRole> {
	if (authContext === null) {
		return 'visitor';
	}

	if (authContext.user.id === wishlistRow.ownerId) {
		return 'owner';
	}

	const database = getDb();
	const modRows = await database
		.select()
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistRow.id),
				eq(moderatorAssignment.userId, authContext.user.id),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);

	return modRows[0] !== undefined ? 'moderator' : 'visitor';
}

/**
 * Resolve the caller's role on a wishlist, requiring owner or moderator access.
 * Throws 404 if the wishlist is missing/deleted, 403 if the caller is neither
 * owner nor an active moderator. Shared by gift and import mutations.
 */
export async function verifyOwnerOrModerator(
	userId: string,
	wishlistId: string,
): Promise<{ role: WishlistRole; wishlistRow: typeof wishlist.$inferSelect }> {
	const database = getDb();

	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt)))
		.limit(1);

	const wishlistRow = rows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}

	if (wishlistRow.ownerId === userId) {
		return { role: 'owner', wishlistRow };
	}

	const modRows = await database
		.select()
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);

	if (modRows[0] !== undefined) {
		return { role: 'moderator', wishlistRow };
	}

	error(403, SERVER_ERROR.ACCESS_DENIED);
}

/** Reject mutations on an archived wishlist (read-only state). */
export function assertWishlistMutable(wishlistRow: typeof wishlist.$inferSelect) {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
}
