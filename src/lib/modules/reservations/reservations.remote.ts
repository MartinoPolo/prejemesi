import { eq, and, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { publicQuery, publicCommand } from '$lib/server/remote.js';
import type { ReserveGiftInput, UnreserveInput, ReservationForModerator } from './types.js';
import type { WishlistRole } from '$lib/modules/wishlists/types.js';

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
		error(404, 'Darek nebyl nalezen');
	}

	return row;
}

async function getActiveReservedCount(giftId: string): Promise<number> {
	const database = getDb();

	const result = await database
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

/**
 * Reserve a gift. Supports both authenticated and anonymous users.
 * Anonymous: anonymousName required, anonymousEmail optional.
 * Owner of the wishlist CANNOT reserve their own gifts.
 * Cannot reserve on archived wishlists.
 */
export const reserveGift = publicCommand(async (authContext, input: ReserveGiftInput) => {
	const database = getDb();
	const { gift: giftRow, wishlist: wishlistRow } = await getGiftWithWishlist(input.giftId);

	// Cannot reserve on archived wishlists
	if (wishlistRow.status === 'archived') {
		error(400, 'Nelze rezervovat na archivovanem seznamu');
	}

	// Owner cannot reserve their own gifts
	if (authContext !== null && authContext.user.id === wishlistRow.ownerId) {
		error(403, 'Vlastnik nemuze rezervovat sve darky');
	}

	// Anonymous users must provide a display name
	if (authContext === null) {
		if (input.anonymousName == null || input.anonymousName.trim() === '') {
			error(400, 'Pro anonymni rezervaci je potreba zadat jmeno');
		}
	}

	// Validate quantity
	const maxQuantity = giftRow.quantity ?? 1;
	const requestedQuantity = input.quantity;

	if (requestedQuantity < 1) {
		error(400, 'Mnozstvi musi byt alespon 1');
	}

	const currentReserved = await getActiveReservedCount(input.giftId);
	const available = maxQuantity - currentReserved;

	if (requestedQuantity > available) {
		error(400, `Neni dostatek dostupnych kusu. Dostupne: ${available}`);
	}

	const [created] = await database
		.insert(reservation)
		.values({
			giftId: input.giftId,
			userId: authContext?.user.id ?? null,
			anonymousName: authContext === null ? input.anonymousName!.trim() : null,
			anonymousEmail:
				authContext === null && input.anonymousEmail != null && input.anonymousEmail !== ''
					? input.anonymousEmail.trim()
					: null,
			quantity: requestedQuantity,
		})
		.returning();

	if (created === undefined) {
		error(500, 'Rezervace se nezdarila');
	}

	return { id: created.id };
});

/**
 * Unreserve a gift. Only the person who reserved can unreserve.
 * Authenticated: match userId. Anonymous: not supported (would need token).
 */
export const unreserveGift = publicCommand(async (authContext, input: UnreserveInput) => {
	const database = getDb();

	const rows = await database
		.select()
		.from(reservation)
		.where(and(eq(reservation.id, input.reservationId), isNull(reservation.deletedAt)))
		.limit(1);

	const reservationRow = rows[0];
	if (reservationRow === undefined) {
		error(404, 'Rezervace nebyla nalezena');
	}

	// Check authorization: only the reserver can unreserve
	if (reservationRow.userId !== null) {
		// Authenticated reservation — must match userId
		if (authContext === null || authContext.user.id !== reservationRow.userId) {
			error(403, 'Nemuzete zrusit cizi rezervaci');
		}
	} else {
		// Anonymous reservation — only moderators can unreserve on behalf
		// For now, anonymous users cannot unreserve (no token mechanism)
		if (authContext === null) {
			error(403, 'Anonymni uzivatele nemohou rusit rezervace');
		}
		// Check if authenticated user is moderator for this wishlist
		const giftRow = await database
			.select({ wishlistId: gift.wishlistId })
			.from(gift)
			.where(eq(gift.id, reservationRow.giftId))
			.limit(1);

		if (giftRow[0] === undefined) {
			error(404, 'Darek nebyl nalezen');
		}

		const role = await determineRole(
			authContext.user.id,
			'', // not owner (we already know it's not an owner reservation)
			giftRow[0].wishlistId,
		);

		if (role !== 'moderator') {
			error(403, 'Nemuzete zrusit anonymni rezervaci');
		}
	}

	// Soft delete
	await database
		.update(reservation)
		.set({ deletedAt: new Date() })
		.where(eq(reservation.id, input.reservationId));

	return { success: true };
});

/**
 * Get reservations for a gift.
 * Owner: returns EMPTY array (owner never sees reservation data).
 * Moderator: returns full details.
 * Visitor: returns empty (visitors see counts via gifts, not individual reservations).
 */
export const getReservationsForGift = publicQuery(async (authContext, giftId: string) => {
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
		displayName: row.anonymousName ?? 'Prihlaseny uzivatel',
		createdAt: row.createdAt,
	}));

	return { reservations, role };
});

/**
 * Get the current user's reservations for a specific gift.
 * Used to show "you already reserved X" and enable unreserve.
 */
export const getMyReservationsForGift = publicQuery(async (authContext, giftId: string) => {
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
