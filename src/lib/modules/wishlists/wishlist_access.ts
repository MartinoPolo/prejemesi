import { eq, and, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from './types.js';
import { canManageWishlist } from './wishlist_capabilities.js';
import { assertWishlistScope, wishlistScope } from '$lib/server/demo/scope.js';

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

/** Fetch a live (non-deleted) wishlist row by id, throwing 404 if missing. */
export async function requireWishlistRow(wishlistId: string): Promise<WishlistRow> {
	const database = getDb();
	const rows = await database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()))
		.limit(1);

	const wishlistRow = rows[0];
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return wishlistRow;
}

/**
 * Management access for remote functions outside the operation core (claim invites and gift
 * category queries): 404 for a missing wishlist, 403 ACCESS_DENIED unless the caller is the
 * recipient or a správce. Operations use `requireWishlistManagement` instead.
 */
export async function verifyManagerAccess(
	userId: string,
	wishlistId: string,
): Promise<{ role: WishlistRole; wishlistRow: WishlistRow }> {
	const wishlistRow = await requireWishlistRow(wishlistId);
	const role = await resolveRoleOnWishlistRow(userId, wishlistRow);

	if (!canManageWishlist(role)) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}

	return { role, wishlistRow };
}

/** Reject mutations on an archived wishlist (read-only state). */
export function assertWishlistMutable(wishlistRow: WishlistRow) {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
}
