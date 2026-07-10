import { eq, and, isNull, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from './types.js';
import { canManageWishlist } from './wishlist_capabilities.js';

/** Whether the user holds an active (non-revoked) moderator assignment on the wishlist. */
async function hasActiveModeratorAssignment(userId: string, wishlistId: string): Promise<boolean> {
	const database = getDb();
	const rows = await database
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);
	return rows[0] !== undefined;
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
	wishlistRow: typeof wishlist.$inferSelect,
): Promise<WishlistRole> {
	if (authContext === null) {
		return WISHLIST_ROLES.visitor;
	}

	if (authContext.user.id === wishlistRow.recipientUserId) {
		return WISHLIST_ROLES.recipient;
	}

	if (await hasActiveModeratorAssignment(authContext.user.id, wishlistRow.id)) {
		return WISHLIST_ROLES.moderator;
	}

	return WISHLIST_ROLES.visitor;
}

/** Fetch a live (non-deleted) wishlist row by id, throwing 404 if missing. */
export async function requireWishlistRow(
	wishlistId: string,
): Promise<typeof wishlist.$inferSelect> {
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
	return wishlistRow;
}

/**
 * Resolve the caller's role on a wishlist, requiring management access
 * (recipient or moderator/správce). Throws 404 if the wishlist is missing/deleted,
 * 403 ACCESS_DENIED otherwise. Shared by every management mutation — gift edits,
 * metadata, sharing, archive, delete, and správce administration.
 */
export async function verifyManagerAccess(
	userId: string,
	wishlistId: string,
): Promise<{ role: WishlistRole; wishlistRow: typeof wishlist.$inferSelect }> {
	const wishlistRow = await requireWishlistRow(wishlistId);

	const role =
		wishlistRow.recipientUserId === userId
			? WISHLIST_ROLES.recipient
			: (await hasActiveModeratorAssignment(userId, wishlistId))
				? WISHLIST_ROLES.moderator
				: WISHLIST_ROLES.visitor;

	if (!canManageWishlist(role)) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}

	return { role, wishlistRow };
}

/** Count of active (non-revoked) správci for a wishlist. Backs the orphan guard. */
async function countActiveModerators(wishlistId: string): Promise<number> {
	const database = getDb();
	const rows = await database
		.select({ value: count() })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	return rows[0]?.value ?? 0;
}

/**
 * Orphan guard: a for-someone list (free-text recipient, no linked account) must keep at
 * least one správce, or nobody can manage it. Throws before revoking the last one.
 * Self-recipient lists are exempt — the linked recipient manages inherently.
 */
export async function assertNotLastManager(
	wishlistRow: typeof wishlist.$inferSelect,
): Promise<void> {
	if (wishlistRow.recipientUserId !== null) {
		return;
	}
	if ((await countActiveModerators(wishlistRow.id)) <= 1) {
		error(403, SERVER_ERROR.CANNOT_REMOVE_LAST_MANAGER);
	}
}

/** Reject mutations on an archived wishlist (read-only state). */
export function assertWishlistMutable(wishlistRow: typeof wishlist.$inferSelect) {
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST);
	}
}
