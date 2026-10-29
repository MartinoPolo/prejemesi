import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import type { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from './types.js';
import { assertWishlistScope } from '$lib/server/demo/scope.js';

type WishlistRow = typeof wishlist.$inferSelect;

/**
 * The user's role on an already loaded wishlist row: linked recipient → active správce → visitor.
 * `lock` holds the správce assignment until commit; without `database` the request database is used.
 */
export async function resolveRoleOnWishlistRow(
	userId: string,
	wishlistRow: WishlistRow,
	options: { database?: DatabaseTransaction | ReturnType<typeof getDb>; lock?: boolean } = {},
): Promise<WishlistRole> {
	if (wishlistRow.recipientUserId === userId) {
		return WISHLIST_ROLES.recipient;
	}
	const assignmentQuery = (options.database ?? getDb())
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistRow.id),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	const [assignment] =
		options.lock === true
			? await assignmentQuery.for('update')
			: await assignmentQuery.limit(1);
	return assignment === undefined ? WISHLIST_ROLES.visitor : WISHLIST_ROLES.moderator;
}

/**
 * Derive the caller's role from an already-fetched wishlist row.
 * Does NOT throw – returns 'visitor' when authContext is null or the user
 * has no elevated access. Use for read-only queries that need role information.
 *
 * Role order: linked recipient → active moderator (správce) → visitor.
 */
export async function resolveWishlistRole(
	authContext: { user: { id: string } } | null,
	wishlistRow: WishlistRow,
): Promise<WishlistRole> {
	assertWishlistScope(wishlistRow);
	if (authContext === null) {
		return WISHLIST_ROLES.visitor;
	}
	return resolveRoleOnWishlistRow(authContext.user.id, wishlistRow);
}

/** Reject mutations on an archived wishlist (read-only state). */
export function assertWishlistMutable(wishlistRow: WishlistRow) {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
}
