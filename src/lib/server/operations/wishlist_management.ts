import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { wishlist, priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { user } from '$lib/server/db/auth.schema.js';
import {
	SERVER_ERROR,
	WISHLIST_NOT_FOUND_MESSAGE,
} from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import {
	assertWishlistMutable,
	resolveRoleOnWishlistRow,
} from '$lib/modules/wishlists/wishlist_access.js';
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

function selectLiveWishlistRow(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	wishlistId: string,
) {
	return database
		.select()
		.from(wishlist)
		.where(and(eq(wishlist.id, wishlistId), isNull(wishlist.deletedAt), wishlistScope()));
}

/**
 * Waits out every exclusive (FOR UPDATE) wishlist change without blocking gift edits,
 * reservations or plain wishlist updates of the same wishlist.
 */
export const KEY_SHARE_WISHLIST_LOCK = 'keyShare';

/** `true` locks the row FOR UPDATE; {@link KEY_SHARE_WISHLIST_LOCK} only orders after exclusive changes. */
export interface WishlistLockOptions {
	lock: boolean | typeof KEY_SHARE_WISHLIST_LOCK;
}

function withWishlistLock(
	wishlistQuery: ReturnType<typeof selectLiveWishlistRow>,
	lock: WishlistLockOptions['lock'],
) {
	if (lock === KEY_SHARE_WISHLIST_LOCK) {
		return wishlistQuery.for('key share');
	}
	return lock ? wishlistQuery.for('update') : wishlistQuery.limit(1);
}

/**
 * Row lock modes of a wishlist: a mutation takes its own wishlists exclusively; the wishlists of
 * linked copies it also writes take key share, so only exclusive wishlist changes wait.
 */
export const WISHLIST_ROW_LOCK = { exclusive: 'update', keyShare: 'key share' } as const;
export type WishlistRowLock = (typeof WISHLIST_ROW_LOCK)[keyof typeof WISHLIST_ROW_LOCK];

/**
 * Locks several wishlist rows in id order, each in the mode `lockModeFor` gives it (exclusive by
 * default), so transactions locking overlapping sets cannot deadlock on each other. Missing rows
 * are skipped; the steps that need them reject.
 */
export async function lockWishlistsInIdOrder(
	transaction: DatabaseTransaction,
	wishlistIds: readonly string[],
	lockModeFor: (wishlistId: string) => WishlistRowLock = () => WISHLIST_ROW_LOCK.exclusive,
): Promise<void> {
	if (wishlistIds.length === 0) {
		return;
	}
	const uniqueWishlistIds = [...new Set(wishlistIds)];
	const lockModes = new Set(uniqueWishlistIds.map(lockModeFor));
	const [onlyLockMode] = lockModes;
	// Postgres locks the rows as the sort returns them; its collation, not JavaScript's, sets the order.
	if (lockModes.size === 1 && onlyLockMode !== undefined) {
		await transaction
			.select({ id: wishlist.id })
			.from(wishlist)
			.where(inArray(wishlist.id, uniqueWishlistIds))
			.orderBy(asc(wishlist.id))
			.for(onlyLockMode);
		return;
	}
	const orderedWishlists = await transaction
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(inArray(wishlist.id, uniqueWishlistIds))
		.orderBy(asc(wishlist.id));
	for (const { id } of orderedWishlists) {
		await transaction
			.select({ id: wishlist.id })
			.from(wishlist)
			.where(eq(wishlist.id, id))
			.for(lockModeFor(id));
	}
}

/** The live (not deleted, in-scope) wishlist row; 404 when missing. */
export async function requireLiveWishlistRow(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	wishlistId: string,
	options: WishlistLockOptions,
): Promise<WishlistRow> {
	const [wishlistRow] = await withWishlistLock(
		selectLiveWishlistRow(transaction, wishlistId),
		options.lock,
	);
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return wishlistRow;
}

/**
 * The live wishlist a viewer acts on for themselves (following, visits, likes). These actions
 * keep their original plain-text 404.
 */
export async function keyShareLockViewedWishlistRow(
	transaction: DatabaseTransaction,
	wishlistId: string,
): Promise<WishlistRow> {
	// Every claim, recipient change, archive and delete locks the row FOR UPDATE first, which key
	// share waits for; viewers never block one another or a plain non-key UPDATE.
	const [wishlistRow] = await selectLiveWishlistRow(transaction, wishlistId).for('key share');
	if (wishlistRow === undefined) {
		error(404, WISHLIST_NOT_FOUND_MESSAGE);
	}
	return wishlistRow;
}

/** The live (not deleted, in-scope) wishlist addressed by its short id; 404 when missing. */
export async function requireLiveWishlistRowByShortId(
	database: ReturnType<typeof getDb>,
	wishlistShortId: string,
): Promise<WishlistRow> {
	const [wishlistRow] = await database
		.select()
		.from(wishlist)
		.where(
			and(eq(wishlist.shortId, wishlistShortId), isNull(wishlist.deletedAt), wishlistScope()),
		)
		.limit(1);
	if (wishlistRow === undefined) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return wishlistRow;
}

/** {@link resolveWishlistAccess}, null for a missing wishlist. */
async function findWishlistAccess(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: WishlistLockOptions,
): Promise<WishlistAccess | null> {
	const [wishlistRow] = await withWishlistLock(
		selectLiveWishlistRow(transaction, wishlistId),
		options.lock,
	);
	if (wishlistRow === undefined) {
		return null;
	}
	const role = await resolveRoleOnWishlistRow(actorUserId, wishlistRow, {
		database: transaction,
		lock: options.lock === true,
	});
	return { role, wishlistRow };
}

/**
 * Resolves the actor's role on a wishlist: the linked recipient, an active správce, or a visitor.
 * 404 for a missing wishlist. `lock` holds the wishlist and the assignment until the batch commits
 * so access cannot be revoked mid-mutation; reads pass the plain database. A key share lock needs no
 * assignment lock: every role change locks the wishlist FOR UPDATE first, so it waits.
 */
export async function resolveWishlistAccess(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: WishlistLockOptions,
): Promise<WishlistAccess> {
	const access = await findWishlistAccess(transaction, actorUserId, wishlistId, options);
	if (access === null) {
		error(404, SERVER_ERROR.WISHLIST_NOT_FOUND);
	}
	return access;
}

/** The actor's management of a wishlist; null when it is missing or the actor only visits it. */
export async function findWishlistManagement(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: WishlistLockOptions,
): Promise<ManagedWishlist | null> {
	const access = await findWishlistAccess(transaction, actorUserId, wishlistId, options);
	if (access === null || access.role === WISHLIST_ROLES.visitor) {
		return null;
	}
	return { role: access.role, wishlistRow: access.wishlistRow };
}

/** {@link resolveWishlistAccess} for management: 403 unless the actor is the recipient or a správce. */
export async function requireWishlistManagement(
	transaction: DatabaseTransaction | ReturnType<typeof getDb>,
	actorUserId: string,
	wishlistId: string,
	options: WishlistLockOptions,
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

/** Users actively following the wishlist. */
export async function activeFollowerUserIds(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	wishlistId: string,
): Promise<string[]> {
	const followerRows = await database
		.select({ userId: wishlistFollower.userId })
		.from(wishlistFollower)
		.where(
			and(eq(wishlistFollower.wishlistId, wishlistId), isNull(wishlistFollower.unfollowedAt)),
		);
	return followerRows.map((row) => row.userId);
}

/** Users holding an active správce assignment on the wishlist. */
export async function activeModeratorUserIds(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	wishlistId: string,
): Promise<string[]> {
	const moderatorRows = await database
		.select({ userId: moderatorAssignment.userId })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	return moderatorRows.map((row) => row.userId);
}

/**
 * The live, unarchived wishlists the user manages as their linked recipient or an active správce,
 * by title: the lists gifts may be copied or shared to.
 */
export function loadManagedOpenWishlists(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	userId: string,
) {
	return database
		.selectDistinct({
			id: wishlist.id,
			shortId: wishlist.shortId,
			title: wishlist.title,
			status: wishlist.status,
			kind: wishlist.kind,
			recipientUserId: wishlist.recipientUserId,
			recipientName: wishlist.recipientName,
			recipientDisplayName: sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`,
			recipientImage: user.image,
		})
		.from(wishlist)
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(
			moderatorAssignment,
			and(
				eq(moderatorAssignment.wishlistId, wishlist.id),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.where(
			and(
				ne(wishlist.status, 'archived'),
				isNull(wishlist.deletedAt),
				wishlistScope(),
				or(eq(wishlist.recipientUserId, userId), eq(moderatorAssignment.userId, userId)),
			),
		)
		.orderBy(wishlist.title);
}
