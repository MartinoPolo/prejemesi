import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import type { Wishlist } from './types.js';
import type { FollowedWishlist, ModeratedWishlist, MyWishlist } from './dashboard_types.js';

type Database = ReturnType<typeof getDb>;
interface WishlistRow {
	wishlist: Wishlist;
}

/** Copy only persisted wishlist columns; query rows may contain role-sensitive aggregates. */
function mapWishlist(row: WishlistRow): Wishlist {
	return {
		id: row.wishlist.id,
		shortId: row.wishlist.shortId,
		recipientUserId: row.wishlist.recipientUserId,
		recipientName: row.wishlist.recipientName,
		title: row.wishlist.title,
		description: row.wishlist.description,
		eventDate: row.wishlist.eventDate,
		status: row.wishlist.status,
		theme: row.wishlist.theme,
		customThemeColor: row.wishlist.customThemeColor,
		palette: row.wishlist.palette,
		imageKey: row.wishlist.imageKey,
		imageSlots: row.wishlist.imageSlots,
		recipientIsModerator: row.wishlist.recipientIsModerator,
		sharedAt: row.wishlist.sharedAt,
		eventDateEditedAt: row.wishlist.eventDateEditedAt,
		archivedAt: row.wishlist.archivedAt,
		deletedAt: row.wishlist.deletedAt,
		createdAt: row.wishlist.createdAt,
		updatedAt: row.wishlist.updatedAt,
	};
}

function totalGiftCount(database: Database, alias: string) {
	return database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as(`${alias}_total_gifts`),
		})
		.from(gift)
		.where(isNull(gift.deletedAt))
		.groupBy(gift.wishlistId)
		.as(`${alias}_total_gifts_sq`);
}

/** SQL for the linked account name or free-text recipient. Requires a left join on user. */
export function recipientDisplayNameSql() {
	return sql<string>`coalesce(${wishlist.recipientName}, ${user.name})`;
}

/** Shared recipient/own invariants; callers keep joins, filtering, sorting, and caps local. */
export function createOwnRolePrimitives(database: Database, currentUserId: string) {
	const totalGifts = totalGiftCount(database, 'own');
	return {
		totalGifts,
		projection: {
			wishlist,
			totalGifts: sql<number>`coalesce(${totalGifts.count}, 0)`,
		},
		predicate: eq(wishlist.recipientUserId, currentUserId),
		map(row: WishlistRow & { totalGifts: unknown }): MyWishlist {
			return { ...mapWishlist(row), totalGifts: Number(row.totalGifts) };
		},
	};
}

/** Shared správce reservation progress and assignment invariants. */
export function createModeratedRolePrimitives(database: Database, currentUserId: string) {
	const totalGifts = totalGiftCount(database, 'moderated');
	const reservedGifts = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(distinct ${gift.id})`.as('moderated_reserved_gifts'),
		})
		.from(gift)
		.innerJoin(reservation, and(eq(reservation.giftId, gift.id), isNull(reservation.deletedAt)))
		.where(isNull(gift.deletedAt))
		.groupBy(gift.wishlistId)
		.as('moderated_reserved_gifts_sq');

	return {
		totalGifts,
		reservedGifts,
		projection: {
			wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			totalGifts: sql<number>`coalesce(${totalGifts.count}, 0)`,
			reservedGifts: sql<number>`coalesce(${reservedGifts.count}, 0)`,
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
	const availableGifts = database
		.select({
			wishlistId: gift.wishlistId,
			count: sql<number>`count(*)`.as('followed_available_gifts'),
		})
		.from(gift)
		.leftJoin(reservation, and(eq(reservation.giftId, gift.id), isNull(reservation.deletedAt)))
		.where(and(isNull(gift.deletedAt), isNull(reservation.id)))
		.groupBy(gift.wishlistId)
		.as('followed_available_gifts_sq');
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
		availableGifts,
		myReservations,
		projection: {
			wishlist,
			recipientDisplayName: recipientDisplayNameSql(),
			availableGifts: sql<number>`coalesce(${availableGifts.count}, 0)`,
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
