import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';

export type WishlistRow = typeof wishlist.$inferSelect;
export type ManagerRole = typeof WISHLIST_ROLES.recipient | typeof WISHLIST_ROLES.moderator;

export interface ManagedWishlist {
	role: ManagerRole;
	wishlistRow: WishlistRow;
}

/**
 * Resolves the actor's management role on a wishlist: the linked recipient or an active správce.
 * 404 for a missing wishlist, 403 for everyone else. `lock` holds the wishlist and the assignment
 * until the batch commits so access cannot be revoked mid-mutation; reads pass the plain database.
 */
export async function requireWishlistManagement(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: { lock: boolean },
): Promise<ManagedWishlist> {
	const wishlistQuery = transaction
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()));
	const [wishlistRow] = options.lock
		? await wishlistQuery.for('update')
		: await wishlistQuery.limit(1);
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	if (wishlistRow.recipientUserId === actorUserId) {
		return { role: WISHLIST_ROLES.recipient, wishlistRow };
	}

	const assignmentQuery = transaction
		.select({ id: moderatorAssignment.id })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, actorUserId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	const [assignment] = options.lock
		? await assignmentQuery.for('update')
		: await assignmentQuery.limit(1);
	if (assignment === undefined) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
	return { role: WISHLIST_ROLES.moderator, wishlistRow };
}

export async function assertWishlistPriorityLevel(
	transaction: DatabaseTransaction,
	wishlistId: string,
	priorityLevelId: string | null,
): Promise<void> {
	if (priorityLevelId === null) {
		return;
	}
	const levels = await transaction
		.select({ id: priorityLevel.id })
		.from(priorityLevel)
		.where(and(eq(priorityLevel.id, priorityLevelId), eq(priorityLevel.wishlistId, wishlistId)))
		.for('key share');
	if (levels[0] === undefined) {
		error(400, SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH);
	}
}
