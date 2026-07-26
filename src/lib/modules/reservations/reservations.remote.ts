import * as v from 'valibot';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { isAppAdmin } from '$lib/server/admin.js';
import {
	publicQuery,
	publicCommand,
	guardedCommand,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { getAnonVisitorId, getOrCreateAnonVisitorId } from '$lib/server/anonymous_visitor.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import {
	canReleaseReservation,
	resolveReservationReleaseCapability,
	RESERVATION_RELEASE_CAPABILITY,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { verifyTurnstileToken } from '$lib/server/turnstile.js';
import {
	ReserveGiftInputSchema,
	UnreserveInputSchema,
	SetReservationPurchasedInputSchema,
	type ReservationForModerator,
} from './types.js';

// ── Executor types ───────────────────────────────────────────────────────────

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbExecutor = Database | Transaction;
type WishlistRow = typeof wishlist.$inferSelect;

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

async function verifyAnonymousReservationTurnstile(turnstileToken: string | undefined) {
	const result = await verifyTurnstileToken({ token: turnstileToken });
	if (result.success) {
		return;
	}

	switch (result.reason) {
		case 'missing':
			error(400, SERVER_ERROR.TURNSTILE_REQUIRED);
		case 'expired_or_replayed':
			error(403, SERVER_ERROR.TURNSTILE_EXPIRED_OR_REPLAYED);
		case 'invalid':
			error(403, SERVER_ERROR.TURNSTILE_INVALID);
		case 'configuration':
		case 'unavailable':
			// Fail open: the bot check could not run at all — the secret is unconfigured
			// (`configuration`) or Cloudflare Siteverify was unreachable (`unavailable`).
			// These are operational failures, not bot signals. Blocking here takes the core
			// guest-reservation flow fully offline whenever Turnstile is misconfigured or down
			// (as happened in production when the keys were never deployed). The action is
			// low-stakes (no money, no account) and other defenses remain in force: a required
			// display name, the per-browser cancel cookie, and Cloudflare WAF rate limiting.
			// Allow the reservation but log it so unverified traffic stays auditable.
			console.warn(
				`[Turnstile] unverified anonymous reservation allowed (fail-open): reason=${result.reason}`,
			);
			return;
	}
}

// ── Commands ───────────────────────────────────────────────────────────────

export const reserveGift = publicCommand(ReserveGiftInputSchema, async (authContext, input) => {
	if (authContext === null) {
		await verifyAnonymousReservationTurnstile(input.turnstileToken);
	}

	const database = getDb();
	const { wishlist: wishlistRow } = await getGiftWithWishlist(input.giftId);

	// Cannot reserve on archived wishlists
	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED);
	}

	// The recipient cannot reserve their own gifts (protects the surprise). Správci may.
	if (authContext !== null && authContext.user.id === wishlistRow.recipientUserId) {
		error(403, SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS);
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
	const { created, giftName } = await database.transaction(async (tx) => {
		const [lockedGift] = await tx
			.select({ quantity: gift.quantity, name: gift.name })
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

		return { created: row, giftName: lockedGift.name };
	});

	if (created === undefined) {
		error(500, SERVER_ERROR.RESERVATION_FAILED);
	}

	const actorUserId = authContext?.user.id ?? null;
	const likedRows = await database
		.select({ userId: giftLike.userId })
		.from(giftLike)
		.where(and(eq(giftLike.giftId, input.giftId), isNull(giftLike.deletedAt)));
	const followerRows = await database
		.select({ userId: wishlistFollower.userId })
		.from(wishlistFollower)
		.where(
			and(
				eq(wishlistFollower.wishlistId, wishlistRow.id),
				isNull(wishlistFollower.unfollowedAt),
			),
		);
	const likedUserIds = likedRows
		.map((row) => row.userId)
		.filter((userId) => userId !== actorUserId && userId !== wishlistRow.recipientUserId);
	const followerUserIds = followerRows
		.map((row) => row.userId)
		.filter((userId) => userId !== actorUserId && userId !== wishlistRow.recipientUserId);

	// Reserver identity is personal data (issue #198): these dispatches carry the server-side
	// actorId only (for de-duplication/ownership checks), never the reserver's display name.
	await dispatchNotification({
		type: NOTIFICATION_TYPE.LIKED_GIFT_RESERVED,
		targetUserIds: likedUserIds,
		wishlistId: wishlistRow.id,
		giftId: input.giftId,
		giftName,
		actorId: actorUserId ?? undefined,
		wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
	});
	await dispatchNotification({
		type: NOTIFICATION_TYPE.GIFT_RESERVED,
		targetUserIds: followerUserIds,
		wishlistId: wishlistRow.id,
		giftId: input.giftId,
		giftName,
		actorId: actorUserId ?? undefined,
		wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
	});

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page tracks this
	// query, so the fresh reservation state rides back on the command response.
	singleFlightRefresh(getGiftsByWishlistShortId, wishlistRow.shortId);

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

	// Known after the release branch resolves it; otherwise looked up post-update
	// for the single-flight refresh only.
	let wishlistShortId: string | null = null;
	// Set on the release path only — a self-cancel notifies nobody (issue #213, REQ-9).
	let releaseContext: { wishlistRow: WishlistRow; giftName: string } | null = null;

	const reservationIsGuest = reservationRow.userId === null;

	if (authContext === null) {
		if (!reservationIsGuest) {
			error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
		}
		// Anonymous reservation cancelled by an anonymous visitor – only the original
		// reserver may, proven by holding the matching per-browser capability cookie.
		const anonVisitorId = getAnonVisitorId();
		if (
			anonVisitorId === null ||
			reservationRow.anonymousVisitorId === null ||
			reservationRow.anonymousVisitorId !== anonVisitorId
		) {
			error(403, SERVER_ERROR.ANONYMOUS_CANNOT_CANCEL_RESERVATIONS);
		}
	} else if (authContext.user.id !== reservationRow.userId) {
		// Release path (issue #213): cancelling on someone else's behalf.
		//
		// The administrator check is a pure env read (`ADMIN_EMAILS`), so a non-administrator
		// reaching for a SIGNED-IN gifter's reservation is rejected here without a single extra
		// statement — a správce has no more reach than a plain visitor on such a row (REQ-2), so
		// resolving their role first would only buy a query we must not spend on a denial.
		const isAdmin = isAppAdmin(authContext.user.email);
		if (!reservationIsGuest && !isAdmin) {
			error(403, SERVER_ERROR.RELEASE_REQUIRES_ADMIN);
		}

		const { gift: giftRow, wishlist: wishlistRow } = await getGiftWithWishlist(
			reservationRow.giftId,
		);
		const role = await resolveWishlistRole(authContext, wishlistRow);
		const capability = resolveReservationReleaseCapability({ role, isAdmin });

		if (!canReleaseReservation(capability, reservationIsGuest)) {
			// On a signed-in gifter's row only the obdarovaný-who-is-also-administrator reaches
			// here (REQ-6) — every other non-administrator was already rejected above with
			// RELEASE_REQUIRES_ADMIN. A guest row keeps the pre-existing „not a správce" code.
			error(
				403,
				reservationIsGuest
					? SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION
					: SERVER_ERROR.ACCESS_DENIED,
			);
		}

		wishlistShortId = wishlistRow.shortId;
		releaseContext = { wishlistRow, giftName: giftRow.name };
	}

	// Soft delete. `cancelledByUserId` records WHO released it on every path (REQ-10); it stays
	// null for a guest self-cancel, which is what makes an override distinguishable.
	await database
		.update(reservation)
		.set({ deletedAt: new Date(), cancelledByUserId: authContext?.user.id ?? null })
		.where(eq(reservation.id, input.reservationId));

	// Tell the gifter their reservation is gone (REQ-9). Only on the release path — cancelling
	// one's own reservation notifies nobody. A guest is reachable only if they left an address.
	if (releaseContext !== null && authContext !== null) {
		const targetUserIds = reservationRow.userId === null ? [] : [reservationRow.userId];
		const targetEmails =
			reservationRow.anonymousEmail === null || reservationRow.anonymousEmail === ''
				? []
				: [reservationRow.anonymousEmail];

		if (targetUserIds.length > 0 || targetEmails.length > 0) {
			await dispatchNotification({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetUserIds,
				targetEmails,
				wishlistId: releaseContext.wishlistRow.id,
				giftId: reservationRow.giftId,
				// Naming the gift is what separates this copy from the bulk revert-to-draft
				// cancellation, which sweeps a whole list and names none.
				giftName: releaseContext.giftName,
				actorId: authContext.user.id,
				actorName: authContext.user.name,
				wishlist: {
					title: releaseContext.wishlistRow.title,
					shortId: releaseContext.wishlistRow.shortId,
				},
			});
		}
	}

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page tracks this
	// query, so the fresh reservation state rides back on the command response.
	// Non-fatal: an unreserve left over on a deleted gift/wishlist still succeeds,
	// just without a refresh.
	if (wishlistShortId === null) {
		const shortIdRows = await database
			.select({ shortId: wishlist.shortId })
			.from(gift)
			.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
			.where(
				and(
					eq(gift.id, reservationRow.giftId),
					isNull(gift.deletedAt),
					isNull(wishlist.deletedAt),
				),
			)
			.limit(1);
		wishlistShortId = shortIdRows[0]?.shortId ?? null;
	}
	if (wishlistShortId !== null) {
		singleFlightRefresh(getGiftsByWishlistShortId, wishlistShortId);
	}

	return { success: true };
});

/**
 * Toggle the gifter-private "I bought this" marker on the caller's own reservation. Optional
 * self-tracking only – never surfaced to the wishlist owner. Authenticated reservations only
 * (anonymous visitors have no persistent identity to track against).
 */
export const setReservationPurchased = guardedCommand(
	SetReservationPurchasedInputSchema,
	async (authContext, input) => {
		const database = getDb();

		// The wishlist shortId joins along for the single-flight gift refresh below.
		const rows = await database
			.select({
				id: reservation.id,
				userId: reservation.userId,
				wishlistShortId: wishlist.shortId,
			})
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.innerJoin(wishlist, eq(gift.wishlistId, wishlist.id))
			.where(and(eq(reservation.id, input.reservationId), isNull(reservation.deletedAt)))
			.limit(1);

		const reservationRow = rows[0];
		if (reservationRow === undefined) {
			error(404, SERVER_ERROR.RESERVATION_NOT_FOUND);
		}

		// Only the reserver may mark their own reservation as bought.
		if (reservationRow.userId !== authContext.user.id) {
			error(403, SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION);
		}

		await database
			.update(reservation)
			.set({ purchasedAt: input.purchased ? new Date() : null })
			.where(eq(reservation.id, input.reservationId));

		// Single-flight refresh (issue #108, REQ-3/4): syncs myReservationPurchasedAt on
		// the open wishlist page in the same round trip.
		singleFlightRefresh(getGiftsByWishlistShortId, reservationRow.wishlistShortId);

		return { purchased: input.purchased };
	},
);

export const getReservationsForGift = publicQuery(v.string(), async (authContext, giftId) => {
	const wishlistRow = (await getGiftWithWishlist(giftId)).wishlist;

	const role = await resolveWishlistRole(authContext, wishlistRow);

	// Správci (guest rows only) and the app administrator (every row) see gifter identities; the
	// obdarovaný — even when they are the administrator — and plain visitors never learn who
	// reserved what (issue #213, REQ-5/REQ-6).
	const capability = resolveReservationReleaseCapability({
		role,
		isAdmin: isAppAdmin(authContext?.user.email),
	});
	if (capability === RESERVATION_RELEASE_CAPABILITY.none) {
		return { reservations: [] as ReservationForModerator[], role };
	}

	const database = getDb();

	// The join resolves a signed-in gifter's real account name — the picker (REQ-4) cannot
	// identify a row without it.
	const rows = await database
		.select({
			id: reservation.id,
			giftId: reservation.giftId,
			quantity: reservation.quantity,
			userId: reservation.userId,
			anonymousName: reservation.anonymousName,
			gifterName: user.name,
			createdAt: reservation.createdAt,
		})
		.from(reservation)
		.leftJoin(user, eq(reservation.userId, user.id))
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.orderBy(reservation.createdAt);

	const reservations: ReservationForModerator[] = rows
		// The viewer's own reservation is cancelled through the single-click path on their own
		// reserve control, never through the release ledger.
		.filter((row) => authContext === null || row.userId !== authContext.user.id)
		.map((row) => ({
			id: row.id,
			giftId: row.giftId,
			quantity: row.quantity,
			// Null only when the gifter's account was deleted (`user_id` drops to NULL) — the UI
			// renders its own placeholder rather than a server-side English fallback.
			displayName: row.anonymousName ?? row.gifterName,
			releasable: canReleaseReservation(capability, row.userId === null),
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
