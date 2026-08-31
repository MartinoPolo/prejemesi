import { and, eq, isNull, type SQLWrapper } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { wishlistVisit } from '$lib/server/db/wishlist_visit.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { sortCategoryRow, buildRecentRow } from './home_overview_sort.js';
import {
	createOwnRolePrimitives,
	createModeratedRolePrimitives,
	createFollowedRolePrimitives,
} from './wishlist_role_query_primitives.js';
import {
	HOME_CATEGORY_CAP,
	HOME_RECENT_CAP,
	HOME_ROLE,
	type HomeOverview,
	type OwnHomeItem,
	type ModeratedHomeItem,
	type FollowedHomeItem,
	type HomeCategoryRow,
	type RecentHomeItem,
} from './home_overview_types.js';

/**
 * Builds the authenticated user's /home overview directly from the database.
 * The three role queries are independent and execute concurrently.
 */
export async function getHomeOverview(userId: string): Promise<HomeOverview> {
	const database = getDb();
	const visitJoin = (wishlistId: SQLWrapper) =>
		and(eq(wishlistVisit.wishlistId, wishlistId), eq(wishlistVisit.userId, userId));

	const ownRole = createOwnRolePrimitives(database, userId);
	const moderatedRole = createModeratedRolePrimitives(database, userId);
	const followedRole = createFollowedRolePrimitives(database, userId);

	const ownRowsPromise = database
		.select({ ...ownRole.projection, lastVisitedAt: wishlistVisit.lastVisitedAt })
		.from(wishlist)
		.leftJoin(ownRole.totalGifts, eq(ownRole.totalGifts.wishlistId, wishlist.id))
		.leftJoin(wishlistVisit, visitJoin(wishlist.id))
		.where(and(ownRole.predicate, isNull(wishlist.deletedAt)));

	const moderatedRowsPromise = database
		.select({ ...moderatedRole.projection, lastVisitedAt: wishlistVisit.lastVisitedAt })
		.from(moderatorAssignment)
		.innerJoin(wishlist, eq(moderatorAssignment.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(moderatedRole.totalGifts, eq(moderatedRole.totalGifts.wishlistId, wishlist.id))
		.leftJoin(
			moderatedRole.reservedGifts,
			eq(moderatedRole.reservedGifts.wishlistId, wishlist.id),
		)
		.leftJoin(wishlistVisit, visitJoin(wishlist.id))
		.where(and(moderatedRole.predicate, isNull(wishlist.deletedAt)));

	const followedRowsPromise = database
		.select({
			...followedRole.projection,
			followDate: wishlistFollower.createdAt,
			lastVisitedAt: wishlistVisit.lastVisitedAt,
		})
		.from(wishlistFollower)
		.innerJoin(wishlist, eq(wishlistFollower.wishlistId, wishlist.id))
		.leftJoin(user, eq(user.id, wishlist.recipientUserId))
		.leftJoin(
			followedRole.availableGifts,
			eq(followedRole.availableGifts.wishlistId, wishlist.id),
		)
		.leftJoin(
			followedRole.myReservations,
			eq(followedRole.myReservations.wishlistId, wishlist.id),
		)
		.leftJoin(wishlistVisit, visitJoin(wishlist.id))
		.where(
			and(
				followedRole.predicate,
				isNull(wishlistFollower.unfollowedAt),
				isNull(wishlist.deletedAt),
			),
		);

	const [ownRows, moderatedRows, followedRows] = await Promise.all([
		ownRowsPromise,
		moderatedRowsPromise,
		followedRowsPromise,
	]);

	const own = ownRows.map(
		(row): OwnHomeItem => ({ ...ownRole.map(row), lastVisitedAt: row.lastVisitedAt }),
	);
	const moderated = moderatedRows.map(
		(row): ModeratedHomeItem => ({
			...moderatedRole.map(row),
			lastVisitedAt: row.lastVisitedAt,
		}),
	);
	const followed = followedRows.map(
		(row): FollowedHomeItem => ({
			...followedRole.map(row),
			followDate: row.followDate,
			lastVisitedAt: row.lastVisitedAt,
		}),
	);

	// Archived lists live behind the full pages' toggle and never appear on /home.
	const isLive = <T extends { status: string }>(item: T) => item.status !== 'archived';
	const ownLive = own.filter(isLive);
	const moderatedLive = moderated.filter(isLive);
	const followedLive = followed.filter(isLive);

	const toRow = <T extends OwnHomeItem | ModeratedHomeItem | FollowedHomeItem>(
		items: T[],
	): HomeCategoryRow<T> => ({
		items: sortCategoryRow(items).slice(0, HOME_CATEGORY_CAP),
		total: items.length,
	});

	// De-duplicate in role-priority order: recipient > správce > follower.
	const seenWishlistIds = new Set<string>();
	const recentCandidates: RecentHomeItem[] = [
		...ownLive.map((item) => ({ ...item, role: HOME_ROLE.own }) as const),
		...moderatedLive.map((item) => ({ ...item, role: HOME_ROLE.moderated }) as const),
		...followedLive.map((item) => ({ ...item, role: HOME_ROLE.followed }) as const),
	].filter((candidate) => {
		if (seenWishlistIds.has(candidate.id)) {
			return false;
		}
		seenWishlistIds.add(candidate.id);
		return true;
	});

	return {
		recent: buildRecentRow(recentCandidates, HOME_RECENT_CAP),
		followed: toRow(followedLive),
		moderated: toRow(moderatedLive),
		own: toRow(ownLive),
	};
}
