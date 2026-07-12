import * as v from 'valibot';
import { eq, and, isNull, inArray, count } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { guardedCommand, singleFlightRefresh } from '$lib/server/remote.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { isAppAdmin } from '$lib/server/admin.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';
import {
	requireWishlistRow,
	resolveWishlistRole,
	verifyManagerAccess,
} from '$lib/modules/wishlists/wishlist_access.js';
import {
	REVERT_CAPABILITY,
	resolveRevertCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { getWishlistByShortId } from '$lib/modules/wishlists/wishlists.remote.js';

export const shareWishlist = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	// Any manager (linked recipient or správce) may share — full management rights (issue #99).
	const { wishlistRow } = await verifyManagerAccess(user.id, wishlistId);

	if (wishlistRow.status === 'archived') {
		error(400, SERVER_ERROR.CANNOT_SHARE_ARCHIVED_WISHLIST);
	}
	if (wishlistRow.sharedAt !== null) {
		return { shortId: wishlistRow.shortId, alreadyShared: true } as const;
	}

	const now = new Date();
	await getDb()
		.update(wishlist)
		.set({
			sharedAt: now,
			status: 'active',
			updatedAt: now,
		})
		.where(eq(wishlist.id, wishlistId));

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
	// new shared status (and its grace-window anchor) in the same round trip.
	singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

	return { shortId: wishlistRow.shortId, alreadyShared: false } as const;
});

/**
 * Revert a shared (active) list back to draft — the inverse of {@link shareWishlist} (issue #150,
 * decision 2026-07-14). Permission is resolved entirely through {@link resolveRevertCapability} so
 * the admin gate never scatters:
 *  - Zero reservations: any správce, silently (no notifications).
 *  - With reservations: app admin only — cancels every active reservation and notifies the
 *    reservers (email to registered + anonymous-with-email; in-app for registered; anonymous
 *    without an email is unreachable, accepted). A non-admin správce is rejected.
 *  - The recipient never reverts (a self list without a separate správce cannot be reverted at all).
 *  - An archived list must be unarchived first (rejected with a clear error).
 *
 * The revert clears `sharedAt` (full edit rights return, event-date lock released, re-share opens a
 * fresh grace window), resets each gift's post-share transparency state (discards description
 * appends — the frozen share-time `description` text is kept — and clears the „Upraveno po sdílení"
 * badge + its snapshot), and keeps likes and followers untouched. The open wishlist page refreshes
 * via single-flight (issue #108); the list stays in the same dashboard bucket, so no dashboard
 * query needs a refresh.
 */
export const revertWishlistToDraft = guardedCommand(v.string(), async ({ user }, wishlistId) => {
	const database = getDb();

	const wishlistRow = await requireWishlistRow(wishlistId);
	const role = await resolveWishlistRole({ user }, wishlistRow);
	const isAdmin = isAppAdmin(user.email);

	// Reservation existence is only consulted for someone who could actually revert (a správce or an
	// admin) on an active list — never for the recipient, and never leaking a count elsewhere.
	const needsReservationCheck =
		wishlistRow.status === 'active' &&
		role !== WISHLIST_ROLES.recipient &&
		(role === WISHLIST_ROLES.moderator || isAdmin);

	let hasReservations = false;
	if (needsReservationCheck) {
		const reservationCountRows = await database
			.select({ value: count() })
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.where(
				and(
					eq(gift.wishlistId, wishlistId),
					isNull(reservation.deletedAt),
					isNull(gift.deletedAt),
				),
			);
		hasReservations = (reservationCountRows[0]?.value ?? 0) > 0;
	}

	const capability = resolveRevertCapability({
		role,
		status: wishlistRow.status,
		isAdmin,
		hasReservations,
	});

	if (capability === REVERT_CAPABILITY.hidden) {
		// A manager/admin on an ARCHIVED list gets the actionable „unarchive first" error; everyone
		// with no revert affordance (recipient, plain visitor, already-draft) gets a uniform denial
		// that leaks nothing about reservation state.
		const couldRevertIfActive =
			role === WISHLIST_ROLES.moderator || (isAdmin && role !== WISHLIST_ROLES.recipient);
		if (couldRevertIfActive && wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_REVERT_ARCHIVED);
		}
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}

	if (capability === REVERT_CAPABILITY.reservedBlocked) {
		error(403, SERVER_ERROR.REVERT_REQUIRES_ADMIN);
	}

	// capability is `clean` or `reserved-admin` → perform the revert.
	const now = new Date();

	const cancelledReservers = await database.transaction(async (tx) => {
		let reservers: { userId: string | null; anonymousEmail: string | null }[] = [];

		if (hasReservations) {
			const activeReservations = await tx
				.select({
					id: reservation.id,
					userId: reservation.userId,
					anonymousEmail: reservation.anonymousEmail,
				})
				.from(reservation)
				.innerJoin(gift, eq(reservation.giftId, gift.id))
				.where(
					and(
						eq(gift.wishlistId, wishlistId),
						isNull(reservation.deletedAt),
						isNull(gift.deletedAt),
					),
				);
			reservers = activeReservations;

			const reservationIds = activeReservations.map((row) => row.id);
			if (reservationIds.length > 0) {
				await tx
					.update(reservation)
					.set({ deletedAt: now })
					.where(inArray(reservation.id, reservationIds));
			}
		}

		// Discard post-share gift state: drop description appends (the frozen share-time text stays
		// in `description`) and clear the „Upraveno po sdílení" badge + its net-zero-revert snapshot,
		// so a future re-share starts clean.
		await tx
			.update(gift)
			.set({
				descriptionAppends: [],
				editedAfterShareAt: null,
				preEditShareSnapshot: null,
			})
			.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)));

		// Clearing `sharedAt` returns full edit rights + releases the event-date lock; a re-share
		// then writes a brand-new `sharedAt` and reopens a correct fresh grace window.
		await tx
			.update(wishlist)
			.set({
				status: 'draft',
				sharedAt: null,
				eventDateEditedAt: null,
				updatedAt: now,
			})
			.where(eq(wishlist.id, wishlistId));

		return reservers;
	});

	// Notify the cancelled reservers (reserved-admin path only). Registered → in-app + email;
	// anonymous-with-email → email. The actor (an admin who may also have reserved) is excluded.
	if (hasReservations) {
		const targetUserIds = cancelledReservers
			.map((row) => row.userId)
			.filter((userId): userId is string => userId !== null && userId !== user.id);
		const targetEmails = cancelledReservers
			.map((row) => row.anonymousEmail)
			.filter((email): email is string => email !== null && email !== '');

		await dispatchNotification({
			type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			targetUserIds,
			targetEmails,
			wishlistId,
			actorId: user.id,
			actorName: user.name,
		});
	}

	// Single-flight refresh (issue #108, REQ-3/4): the open wishlist page gets the
	// reverted-to-draft status in the same round trip.
	singleFlightRefresh(getWishlistByShortId, wishlistRow.shortId);

	return { shortId: wishlistRow.shortId, reverted: true } as const;
});
