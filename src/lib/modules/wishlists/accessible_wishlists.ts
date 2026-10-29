import { and, desc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlistScope } from '$lib/server/demo/scope.js';
import { recipientDisplayNameSql } from './wishlist_role_query_primitives.js';
import { WISHLIST_ROLES, type WishlistRole } from './types.js';

/** A wishlist the user receives, manages or follows, with no reservation data. */
export interface AccessibleWishlist {
	id: string;
	shortId: string;
	title: string;
	recipientDisplayName: string;
	status: typeof wishlist.$inferSelect.status;
	kind: typeof wishlist.$inferSelect.kind;
	eventDate: typeof wishlist.$inferSelect.eventDate;
	/** Recipient, then správce, then follower (`visitor`) when the user holds several. */
	role: WishlistRole;
}

function accessRole(isRecipient: boolean, isManager: boolean): WishlistRole {
	if (isRecipient) {
		return WISHLIST_ROLES.recipient;
	}
	return isManager ? WISHLIST_ROLES.moderator : WISHLIST_ROLES.visitor;
}

/** Every non-deleted wishlist the user receives, manages or follows, newest first. */
export async function listAccessibleWishlists(userId: string): Promise<AccessibleWishlist[]> {
	const database = getDb();
	const activeAssignment = database
		.select({ wishlistId: moderatorAssignment.wishlistId })
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlist.id),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		);
	const activeFollow = database
		.select({ wishlistId: wishlistFollower.wishlistId })
		.from(wishlistFollower)
		.where(
			and(
				eq(wishlistFollower.wishlistId, wishlist.id),
				eq(wishlistFollower.userId, userId),
				isNull(wishlistFollower.unfollowedAt),
			),
		);
	const rows = await database
		.select({
			id: wishlist.id,
			shortId: wishlist.shortId,
			title: wishlist.title,
			recipientDisplayName: recipientDisplayNameSql(),
			status: wishlist.status,
			kind: wishlist.kind,
			eventDate: wishlist.eventDate,
			recipientUserId: wishlist.recipientUserId,
			isManager: sql<boolean>`${exists(activeAssignment)}`.mapWith(Boolean),
		})
		.from(wishlist)
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.where(
			and(
				isNull(wishlist.deletedAt),
				wishlistScope(),
				or(
					eq(wishlist.recipientUserId, userId),
					exists(activeAssignment),
					exists(activeFollow),
				),
			),
		)
		.orderBy(desc(wishlist.createdAt), wishlist.id);
	return rows.map(({ recipientUserId, isManager, ...accessible }) => ({
		...accessible,
		role: accessRole(recipientUserId === userId, isManager),
	}));
}
