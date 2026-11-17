import { and, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import type { Wishlist } from './types.js';
import { sanitizeWishlistAppearance } from './wishlist_appearance.js';
import type { FollowedWishlist, ModeratedWishlist, MyWishlist } from './dashboard_types.js';

type Database = ReturnType<typeof getDb>;
interface WishlistRow {
	wishlist: Wishlist;
}

/** Copy only persisted wishlist columns; query rows may contain role-sensitive aggregates. */
function mapWishlist(row: WishlistRow): Wishlist {
	return {
		id: row.wishlist.id,
		demoSessionId: row.wishlist.demoSessionId,
		shortId: row.wishlist.shortId,
		recipientUserId: row.wishlist.recipientUserId,
		recipientName: row.wishlist.recipientName,
		title: row.wishlist.title,
		description: row.wishlist.description,
		eventDate: row.wishlist.eventDate,
		status: row.wishlist.status,
		kind: row.wishlist.kind,
		occasion: row.wishlist.occasion,
		theme: row.wishlist.theme,
		customThemeColor: row.wishlist.customThemeColor,
		palette: row.wishlist.palette,
		...sanitizeWishlistAppearance(row.wishlist),
		imageKey: row.wishlist.imageKey,
		imageSlots: row.wishlist.imageSlots,
		recipientIsModerator: row.wishlist.recipientIsModerator,
		sharedAt: row.wishlist.sharedAt,
		firstSharedAt: row.wishlist.firstSharedAt,
		eventDateEditedAt: row.wishlist.eventDateEditedAt,
		archivedAt: row.wishlist.archivedAt,
		deletedAt: row.wishlist.deletedAt,
		createdAt: row.wishlist.createdAt,
		updatedAt: row.wishlist.updatedAt,
	};
}

/** Correlated to the gift row of `liveGiftCountSql`, so it is only valid as its filter. */
function activeReservationExistsSql() {
	return sql`exists (select 1 from ${reservation} where ${reservation.giftId} = ${gift.id} and ${reservation.deletedAt} is null)`;
}

/**
 * Counts the live gifts of the outer query's wishlist row, optionally narrowed by `giftFilter`.
 * Correlated rather than a grouped derived table, so Postgres reads only that wishlist's gifts
 * through its indexes instead of aggregating every gift for each dashboard query.
 */
function liveGiftCountSql(giftFilter?: SQL) {
	const filter = giftFilter === undefined ? sql`` : sql` and ${giftFilter}`;
	// Nested so Drizzle keeps the table qualifiers: a single-table select strips them from the
	// top-level columns of a selected expression, which would bind `id` to the inner gift.
	const subquery = sql`select count(*) from ${gift} where ${gift.wishlistId} = ${wishlist.id} and ${gift.deletedAt} is null${filter}`;
	return sql<number>`(${subquery})`;
}

/** SQL for the linked account name or free-text recipient. Requires a left join on user. */
export function recipientDisplayNameSql() {
	return sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`;
}

/** Shared recipient/own invariants; callers keep joins, filtering, sorting, and caps local. */
export function createOwnRolePrimitives(currentUserId: string) {
	return {
		projection: {
			wishlist,
			totalGifts: liveGiftCountSql(),
		},
		predicate: eq(wishlist.recipientUserId, currentUserId),
		map(row: WishlistRow & { totalGifts: unknown }): MyWishlist {
			return { ...mapWishlist(row), totalGifts: Number(row.totalGifts) };
		},
	};
}

/** Shared správce reservation progress and assignment invariants. */
export function createModeratedRolePrimitives(currentUserId: string) {
	return {
		projection: {
			wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			totalGifts: liveGiftCountSql(),
			reservedGifts: liveGiftCountSql(activeReservationExistsSql()),
		},
		predicate: and(
			eq(moderatorAssignment.userId, currentUserId),
			isNull(moderatorAssignment.deletedAt),
		),
		map(
			row: WishlistRow & {
				recipientDisplayName: string;
				totalGifts: unknown;
				reservedGifts: unknown;
			},
		): ModeratedWishlist {
			return {
				...mapWishlist(row),
				recipientDisplayName: row.recipientDisplayName,
				totalGifts: Number(row.totalGifts),
				reservedGifts: Number(row.reservedGifts),
			};
		},
	};
}

/** Shared follower counts and role predicate; active-follow filtering stays caller-local. */
export function createFollowedRolePrimitives(database: Database, currentUserId: string) {
	const myReservations = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('followed_my_reservations'),
			purchasedCount:
				sql<number>`count(*) filter (where ${reservation.purchasedAt} is not null)`.as(
					'followed_my_purchased',
				),
		})
		.from(reservation)
		.innerJoin(gift, eq(reservation.giftId, gift.id))
		.where(
			and(
				eq(reservation.userId, currentUserId),
				isNull(reservation.deletedAt),
				isNull(gift.deletedAt),
			),
		)
		.groupBy(gift.wishlistId)
		.as('followed_my_reservations_sq');

	return {
		myReservations,
		projection: {
			wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			availableGifts: liveGiftCountSql(sql`not ${activeReservationExistsSql()}`),
			myReservations: sql<number>`coalesce(${myReservations.count}, 0)`,
			myPurchased: sql<number>`coalesce(${myReservations.purchasedCount}, 0)`,
			unfollowedAt: wishlistFollower.unfollowedAt,
		},
		predicate: and(
			eq(wishlistFollower.userId, currentUserId),
			or(isNull(wishlist.recipientUserId), ne(wishlist.recipientUserId, currentUserId)),
		),
		map(
			row: WishlistRow & {
				recipientDisplayName: string;
				availableGifts: unknown;
				myReservations: unknown;
				myPurchased: unknown;
				unfollowedAt: Date | null;
			},
		): FollowedWishlist {
			return {
				...mapWishlist(row),
				recipientDisplayName: row.recipientDisplayName,
				availableGifts: Number(row.availableGifts),
				myReservations: Number(row.myReservations),
				myPurchased: Number(row.myPurchased),
				unfollowedAt: row.unfollowedAt,
			};
		},
	};
}
