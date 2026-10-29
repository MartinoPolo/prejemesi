import * as v from 'valibot';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { resolveWishlistRole } from '$lib/modules/wishlists/wishlist_access.js';
import {
	RESERVATION_RELEASE_CAPABILITY,
	canReleaseReservation,
	resolveReservationReleaseCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
import { OPERATION_EXPOSURE, OPERATION_KIND, defineOperation } from './operation.js';
import { requireLiveWishlistRowByShortId } from './wishlist_management.js';

/**
 * The issue #213 release ledger: every reservation on the wishlist except the viewer's own, with
 * gifter names, for a správce (guest rows releasable) or an administrator (all releasable). The
 * recipient, even an administrator, and visitors get an empty ledger.
 */
export const readReservationLedgerOperation = defineOperation({
	name: 'readReservationLedger',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: v.strictObject({ wishlistShortId: v.string() }),
	async run({ actor }, { wishlistShortId }) {
		const database = getDb();
		const wishlistRow = await requireLiveWishlistRowByShortId(database, wishlistShortId);
		const role = await resolveWishlistRole(
			actor === null ? null : { user: { id: actor.userId } },
			wishlistRow,
		);
		const capability = resolveReservationReleaseCapability({
			role,
			isAdmin: actor?.isAppAdministrator ?? false,
		});
		const reservationsByGiftId: Record<string, ReservationForModerator[]> = {};
		if (capability === RESERVATION_RELEASE_CAPABILITY.none) {
			return { reservationsByGiftId, role };
		}

		// Joining through gift scopes every row to this wishlist without trusting client gift ids.
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
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.leftJoin(user, eq(reservation.userId, user.id))
			.where(
				and(
					eq(gift.wishlistId, wishlistRow.id),
					isNull(gift.deletedAt),
					isNull(reservation.deletedAt),
				),
			)
			.orderBy(reservation.createdAt);
		for (const row of rows) {
			if (actor !== null && row.userId === actor.userId) {
				continue;
			}
			(reservationsByGiftId[row.giftId] ??= []).push({
				id: row.id,
				giftId: row.giftId,
				quantity: row.quantity,
				displayName: row.anonymousName ?? row.gifterName,
				releasable: canReleaseReservation(capability, row.userId === null),
				createdAt: row.createdAt,
			});
		}
		return { reservationsByGiftId, role };
	},
});

/** The actor's own active reservations of one gift; an anonymous caller has none to list. */
export const readMyGiftReservationsOperation = defineOperation({
	name: 'readMyGiftReservations',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ giftId: v.string() }),
	async run({ actor }, { giftId }) {
		if (actor === null) {
			return [];
		}
		return getDb()
			.select({
				id: reservation.id,
				quantity: reservation.quantity,
				createdAt: reservation.createdAt,
			})
			.from(reservation)
			.where(
				and(
					eq(reservation.giftId, giftId),
					eq(reservation.userId, actor.userId),
					isNull(reservation.deletedAt),
				),
			)
			.orderBy(reservation.createdAt);
	},
});
