import { and, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_KIND, WISHLIST_ROLES, type WishlistKind } from '$lib/modules/wishlists/types.js';
import type { ManagedWishlist, WishlistRow } from './wishlist_management.js';

/**
 * A gift follows the strict post-share rules (name freeze, append-only description, raise-only
 * quantity, deletion grace) unless its wishlist is permanent and nobody has reserved it.
 */
export function giftFollowsStrictPostShareRules(
	wishlistKind: WishlistKind,
	hasActiveReservation: boolean,
): boolean {
	return wishlistKind !== WISHLIST_KIND.permanent || hasActiveReservation;
}

export async function giftHasActiveReservation(
	transaction: DatabaseTransaction,
	giftId: string,
): Promise<boolean> {
	const [activeReservation] = await transaction
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(eq(reservation.giftId, giftId), isNull(reservation.deletedAt)))
		.limit(1);
	return activeReservation !== undefined;
}

/** The subset of the given gifts that have an active reservation, in one query. */
export async function loadReservedGiftIds(
	transaction: DatabaseTransaction,
	giftIds: readonly string[],
): Promise<Set<string>> {
	if (giftIds.length === 0) {
		return new Set();
	}
	const reservedRows = await transaction
		.selectDistinct({ giftId: reservation.giftId })
		.from(reservation)
		.where(and(inArray(reservation.giftId, [...giftIds]), isNull(reservation.deletedAt)));
	return new Set(reservedRows.map((row) => row.giftId));
}

/**
 * {@link giftFollowsStrictPostShareRules} for a gift the caller already holds FOR UPDATE: a
 * reservation locks the gift before inserting, so none can appear between this read and the write.
 * Occasion wishlists never consult reservations.
 */
export async function lockedGiftFollowsStrictPostShareRules(
	transaction: DatabaseTransaction,
	wishlistRow: Pick<WishlistRow, 'kind'>,
	giftId: string,
): Promise<boolean> {
	if (wishlistRow.kind !== WISHLIST_KIND.permanent) {
		return true;
	}
	return giftFollowsStrictPostShareRules(
		wishlistRow.kind,
		await giftHasActiveReservation(transaction, giftId),
	);
}

/**
 * Reservers hear about a správce changing their gift; on a permanent wishlist, whose gifts change
 * over time, they also hear about the recipient's changes.
 */
export function managerEditNotifiesReservers(managedWishlist: ManagedWishlist): boolean {
	return (
		managedWishlist.role === WISHLIST_ROLES.moderator ||
		managedWishlist.wishlistRow.kind === WISHLIST_KIND.permanent
	);
}

/** A permanent wishlist has no event date. */
export function assertEventDateAllowed(
	wishlistKind: WishlistKind,
	eventDate: Date | null | undefined,
): void {
	if (wishlistKind === WISHLIST_KIND.permanent && eventDate !== undefined && eventDate !== null) {
		error(400, SERVER_ERROR.PERMANENT_WISHLIST_EVENT_DATE);
	}
}

/**
 * Permanent → occasion is allowed any time; occasion → permanent only before the wishlist is
 * shared, because gifters of a shared occasion list rely on its strict rules. Becoming permanent
 * clears the event date and its lock; a shared list becoming an occasion opens a fresh event-date
 * window, since gifters never relied on a date it did not have.
 */
export function planWishlistKindChange(
	wishlistRow: Pick<WishlistRow, 'kind' | 'sharedAt'>,
	requestedKind: WishlistKind | undefined,
	now: Date,
): Partial<Pick<WishlistRow, 'kind' | 'eventDate' | 'eventDateEditedAt'>> {
	if (requestedKind === undefined || requestedKind === wishlistRow.kind) {
		return {};
	}
	if (requestedKind === WISHLIST_KIND.occasion) {
		return wishlistRow.sharedAt === null
			? { kind: requestedKind }
			: { kind: requestedKind, eventDateEditedAt: now };
	}
	if (wishlistRow.sharedAt !== null) {
		error(409, SERVER_ERROR.CANNOT_MAKE_SHARED_WISHLIST_PERMANENT);
	}
	return { kind: requestedKind, eventDate: null, eventDateEditedAt: null };
}
