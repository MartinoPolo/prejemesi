import * as v from 'valibot';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { publicQuery, publicCommand } from '$lib/server/remote.js';
import { getAnonVisitorId, getOrCreateAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import {
	ReserveGiftInputSchema,
	UnreserveInputSchema,
	type ReservationForModerator,
} from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

// ── Executor types ───────────────────────────────────────────────────────────

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbExecutor = Database | Transaction;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getGiftWithWishlist(giftId: string) {
	const database = getDb();

	const rows = await database
		.select({
			gift: gift,
			wishlist: wishlist,
		})
		.from(gift)
		.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
		.where(and(eq(gift.id, giftId), isNull(gift.deletedAt), isNull(wishlist.deletedAt)))
		.limit(1);

	const row = rows[0];
	if (row === undefined) {
		error(404, SERVER_ERROR.GIFT_NOT_FOUND);
	}

	return row;
}

async function getActiveReservedCount(giftId: string, executor: DbExecutor): Promise<number> {
	const result = await executor
		.select({
			totalQuantity: sql<number>`COALESCE(SUM(${reservation.quantity}), 0)`,
		})
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)));

	return Number(result[0]?.totalQuantity ?? 0);
}

async function determineRole(
	userId: string | null,
	wishlistOwnerId: string,
	wishlistId: string,
): Promise<WishlistRole> {
	if (userId === null) {
		return 'visitor';
	}
	if (userId === wishlistOwnerId) {
		return 'owner';
	}

	const database = getDb();
	const modRows = await database
		.select()
		.from(moderatorAssignment)
		.where(
			and(
				eq(moderatorAssignment.wishlistId, wishlistId),
				eq(moderatorAssignment.userId, userId),
				isNull(moderatorAssignment.deletedAt),
			),
		)
		.limit(1);

	if (modRows[0] !== undefined) {
		return 'moderator';
	}

	return 'visitor';
}

// ── Commands ───────────────────────────────────────────────────────────────

export const reserveGift = publicCommand(ReserveGiftInputSchema, async (authContext, input) => {
	const database = getDb();
	const { wishlist: wishlistRow } = await getGiftWithWishlist(input.giftId);

	// Cannot reserve on archived wishlists
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED);
	}

	// Owner cannot reserve their own gifts
	if (authContext !== null && authContext.user.id === wishlistRow.ownerId) {
		error(403, SERVER_ERROR.OWNER_CANNOT_RESERVE_OWN_GIFTS);
	}

	// Anonymous users must provide a display name
	if (authContext === null) {
		if (input.anonymousName == null || input.anonymousName.trim() === '') {
			error(400, SERVER_ERROR.ANONYMOUS_NAME_REQUIRED);
		}
	}

	// Validate quantity
	const requestedQuantity = input.quantity;
	if (requestedQuantity < 1) {
		error(400, SERVER_ERROR.QUANTITY_MUST_BE_AT_LEAST_ONE);
	}

	// Anonymous reservations get a per-browser capability token (cookie) so the
	// visitor can later recognise and cancel their own reservation.
	const anonymousVisitorId = authContext === null ? getOrCreateAnonVisitorId() : null;

	// Capacity enforcement must be atomic to prevent overbooking under concurrency.
	// Lock the gift row (SELECT ... FOR UPDATE) so concurrent reservations for the
	// same gift serialize: each request recounts active reservations under the lock
	// before inserting.
	const created = await database.transaction(async (tx) => {
		const [lockedGift] = await tx
			.select({ quantity: gift.quantity })
			.from(gift)
			.where(and(eq(gift.id, input.giftId), isNull(gift.deletedAt)))
			.for('update')
			.limit(1);

		if (lockedGift === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		const maxQuantity = lockedGift.quantity ?? 1;
		const currentReserved = await getActiveReservedCount(input.giftId, tx);
		const available = maxQuantity - currentReserved;

		if (requestedQuantity > available) {
			error(400, encodeServerError(SERVER_ERROR.NOT_ENOUGH_AVAILABLE, { available }));
		}

		const [row] = await tx
			.insert(reservation)
			.values({
				giftId: input.giftId,
				userId: authContext?.user.id ?? null,
				anonymousName: authContext === null ? input.anonymousName!.trim() : null,
				anonymousEmail:
					authContext === null &&
					input.anonymousEmail != null &&
					input.anonymousEmail !== ''
						? input.anonymousEmail.trim()
						: null,
				anonymousVisitorId,
				quantity: requestedQuantity,
			})
			.returning();

		return row;
	});

	if (created === undefined) {
		error(500, SERVER_ERROR.RESERVATION_FAILED);
	}

	return { id: created.id };
});

export const unreserveGift = publicCommand(UnreserveInputSchema, async (authContext, input) => {
	const database = getDb();

	const rows = await database
		.select()
		.from(reservation)
		.where(and(eq(reservation.id, input.reservationId), isNull(reservation.deletedAt)))
		.limit(1);

	const reservationRow = rows[0];
	if (reservationRow === undefined) {
		error(404, SERVER_ERROR.RESERVATION_NOT_FOUND);
	}

	// Check authorization: only the reserver (or a moderator) can unreserve
	if (reservationRow.userId !== null) {
		// Authenticated reservation — must match userId
		if (authContext === null || authContext.user.id !== reservationRow.userId) {
			error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
		}
	} else if (authContext === null) {
		// Anonymous reservation cancelled by an anonymous visitor — only the original
		// reserver may, proven by holding the matching per-browser capability cookie.
		const anonVisitorId = getAnonVisitorId();
		if (
			anonVisitorId === null ||
			reservationRow.anonymousVisitorId === null ||
			reservationRow.anonymousVisitorId !== anonVisitorId
		) {
			error(403, SERVER_ERROR.ANONYMOUS_CANNOT_CANCEL_RESERVATIONS);
		}
	} else {
		// Anonymous reservation cancelled by an authenticated user — must be a moderator.
		const giftRow = await database
			.select({ wishlistId: gift.wishlistId })
			.from(gift)
			.where(eq(gift.id, reservationRow.giftId))
			.limit(1);

		if (giftRow[0] === undefined) {
			error(404, SERVER_ERROR.GIFT_NOT_FOUND);
		}

		const role = await determineRole(authContext.user.id, '', giftRow[0].wishlistId);

		if (role !== 'moderator') {
			error(403, SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION);
		}
	}

	// Soft delete
	await database
		.update(reservation)
		.set({ deletedAt: new Date() })
		.where(eq(reservation.id, input.reservationId));

	return { success: true };
});

export const getReservationsForGift = publicQuery(v.string(), async (authContext, giftId) => {
	const wishlistRow = (await getGiftWithWishlist(giftId)).wishlist;

	const userId = authContext?.user.id ?? null;
	const role = await determineRole(userId, wishlistRow.ownerId, wishlistRow.id);

	// Owner never sees reservation data
	if (role === 'owner') {
		return { reservations: [] as ReservationForModerator[], role };
	}

	// Only moderators see full reservation details
	if (role !== 'moderator') {
		return { reservations: [] as ReservationForModerator[], role };
	}

	const database = getDb();

	const rows = await database
		.select()
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.orderBy(reservation.createdAt);

	const reservations: ReservationForModerator[] = rows.map((row) => ({
		id: row.id,
		giftId: row.giftId,
		quantity: row.quantity,
		displayName: row.anonymousName ?? 'Authenticated user',
		createdAt: row.createdAt,
	}));

	return { reservations, role };
});

export const getMyReservationsForGift = publicQuery(v.string(), async (authContext, giftId) => {
	if (authContext === null) {
		return [];
	}

	const database = getDb();

	const rows = await database
		.select({
			id: reservation.id,
			quantity: reservation.quantity,
			createdAt: reservation.createdAt,
		})
		.from(reservation)
		.where(
			and(
				eq(reservation.giftId, giftId),
				eq(reservation.userId, authContext.user.id),
				isNull(reservation.deletedAt),
			),
		)
		.orderBy(reservation.createdAt);

	return rows;
});
