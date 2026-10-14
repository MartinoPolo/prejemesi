import { and, eq, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import type { MutationOperationContext } from './operation.js';

export type WishlistRow = typeof wishlist.$inferSelect;
export type ManagerRole = typeof WISHLIST_ROLES.recipient | typeof WISHLIST_ROLES.moderator;

export interface ManagedWishlist {
	role: ManagerRole;
	wishlistRow: WishlistRow;
}

interface WishlistAccess {
	role: WishlistRole;
	wishlistRow: WishlistRow;
}

/** The live (not deleted, in-scope) wishlist row; 404 when missing. */
export async function requireLiveWishlistRow(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	wishlistId: string,
	options: { lock: boolean },
): Promise<WishlistRow> {
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
	return wishlistRow;
}

/**
 * Resolves the actor's role on a wishlist: the linked recipient, an active správce, or a visitor.
 * 404 for a missing wishlist. `lock` holds the wishlist and the assignment until the batch commits
 * so access cannot be revoked mid-mutation; reads pass the plain database.
 */
export async function resolveWishlistAccess(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: { lock: boolean },
): Promise<WishlistAccess> {
	const wishlistRow = await requireLiveWishlistRow(transaction, wishlistId, options);
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
	return {
		role: assignment === undefined ? WISHLIST_ROLES.visitor : WISHLIST_ROLES.moderator,
		wishlistRow,
	};
}

/** {@link resolveWishlistAccess} for management: 403 unless the actor is the recipient or a správce. */
export async function requireWishlistManagement(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: { lock: boolean },
): Promise<ManagedWishlist> {
	const { role, wishlistRow } = await resolveWishlistAccess(
		transaction,
		actorUserId,
		wishlistId,
		options,
	);
	if (role === WISHLIST_ROLES.visitor) {
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
	return { role, wishlistRow };
}

/** {@link requireWishlistManagement} inside a mutation, rejecting an archived (read-only) wishlist. */
export async function requireMutableManagedWishlist(
	context: Pick<MutationOperationContext, 'actor' | 'transaction'>,
	wishlistId: string,
	options: { lock: boolean },
): Promise<WishlistRow> {
	const { wishlistRow } = await requireWishlistManagement(
		context.transaction,
		context.actor.userId,
		wishlistId,
		options,
	);
	assertWishlistMutable(wishlistRow);
	return wishlistRow;
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
