import { and, count, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction, getDb } from '$lib/server/db/index.js';
import { gift, reservation } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES, type WishlistRole } from '$lib/modules/wishlists/types.js';
import {
	REVERT_CAPABILITY,
	resolveRevertCapability,
	type RevertCapability,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { MutationOperationContext } from './operation.js';
import type { WishlistRow } from './wishlist_management.js';

interface RevertAccess {
	capability: RevertCapability;
	hasReservations: boolean;
}

/**
 * The actor's revert-to-draft capability. Reservation existence is consulted only for someone who
 * could actually revert (a správce or an administrator) on an active list, never for the recipient,
 * so the answer cannot leak reservation state.
 */
export async function resolveRevertAccess(
	database: DatabaseTransaction | ReturnType<typeof getDb>,
	params: { role: WishlistRole; wishlistRow: WishlistRow; isAppAdministrator: boolean },
): Promise<RevertAccess> {
	const { role, wishlistRow, isAppAdministrator } = params;
	const needsReservationCheck =
		wishlistRow.status === 'active' &&
		role !== WISHLIST_ROLES.recipient &&
		(role === WISHLIST_ROLES.moderator || isAppAdministrator);
	let hasReservations = false;
	if (needsReservationCheck) {
		const [reservationCount] = await database
			.select({ value: count() })
			.from(reservation)
			.innerJoin(gift, eq(reservation.giftId, gift.id))
			.where(
				and(
					eq(gift.wishlistId, wishlistRow.id),
					isNull(reservation.deletedAt),
					isNull(gift.deletedAt),
				),
			);
		hasReservations = (reservationCount?.value ?? 0) > 0;
	}
	const capability = resolveRevertCapability({
		role,
		status: wishlistRow.status,
		isAdmin: isAppAdministrator,
		hasReservations,
	});
	return { capability, hasReservations };
}

/**
 * A manager or administrator on an archived list gets the actionable „unarchive first" error;
 * everyone else without the capability gets a uniform denial that leaks nothing about reservations.
 */
export function assertRevertAllowed(
	capability: RevertCapability,
	params: { role: WishlistRole; wishlistRow: WishlistRow; isAppAdministrator: boolean },
): void {
	if (capability === REVERT_CAPABILITY.hidden) {
		const couldRevertIfActive =
			params.role === WISHLIST_ROLES.moderator ||
			(params.isAppAdministrator && params.role !== WISHLIST_ROLES.recipient);
		if (couldRevertIfActive && params.wishlistRow.status === 'archived') {
			error(400, SERVER_ERROR.CANNOT_REVERT_ARCHIVED);
		}
		error(403, SERVER_ERROR.ACCESS_DENIED);
	}
	if (capability === REVERT_CAPABILITY.reservedBlocked) {
		error(403, SERVER_ERROR.REVERT_REQUIRES_ADMIN);
	}
}

export interface CancelledReserver {
	userId: string | null;
	anonymousEmail: string | null;
}

/** Cancels every active reservation on the wishlist, attributed to the reverting actor. */
export async function cancelActiveReservations(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<CancelledReserver[]> {
	const activeReservations = await context.transaction
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
	const reservationIds = activeReservations.map((row) => row.id);
	if (reservationIds.length > 0) {
		await context.transaction
			.update(reservation)
			.set({ deletedAt: context.now, cancelledByUserId: context.actor.userId })
			.where(inArray(reservation.id, reservationIds));
	}
	return activeReservations;
}

/**
 * Discards post-share gift state: description appends (the frozen share-time text stays in
 * `description`), the „Upraveno po sdílení" badge and its net-zero-revert snapshot. Each cleared
 * gift gets a revision, so undoing an earlier post-share edit reports a conflict instead of
 * silently restoring discarded appends.
 */
export async function clearPostShareGiftState(
	context: MutationOperationContext,
	wishlistId: string,
): Promise<void> {
	const giftsWithPostShareState = await context.transaction
		.select()
		.from(gift)
		.where(
			and(
				eq(gift.wishlistId, wishlistId),
				isNull(gift.deletedAt),
				or(
					sql`${gift.descriptionAppends} <> '[]'::jsonb`,
					isNotNull(gift.editedAfterShareAt),
					isNotNull(gift.preEditShareSnapshot),
				),
			),
		)
		.orderBy(gift.id)
		.for('update');
	if (giftsWithPostShareState.length === 0) {
		return;
	}
	const clearedState = {
		descriptionAppends: [],
		editedAfterShareAt: null,
		preEditShareSnapshot: null,
	};
	await context.transaction
		.update(gift)
		.set(clearedState)
		.where(
			inArray(
				gift.id,
				giftsWithPostShareState.map((giftRow) => giftRow.id),
			),
		);
	context.recordGiftRevisions(
		giftsWithPostShareState.map((giftRow) => ({
			giftId: giftRow.id,
			wishlistId,
			before: giftRow,
			after: { ...giftRow, ...clearedState },
		})),
	);
}
