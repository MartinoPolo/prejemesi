import { and, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { reservation } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	WISHLIST_KIND,
	WISHLIST_ROLES,
	type WishlistKind,
	type WishlistOccasion,
} from '$lib/modules/wishlists/types.js';
import {
	occasionAfterKindWrite,
	wishlistKindForOccasion,
} from '$lib/modules/wishlists/wishlist_occasion.js';
import { giftFollowsStrictPostShareRules } from '$lib/modules/gifts/gift_strict_post_share_rules.js';
import { hasUpcomingEventDate } from '$lib/modules/wishlists/event_date.js';
import type { ManagedWishlist, WishlistRow } from './wishlist_management.js';

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
 * Permanent → occasion is allowed any time. Occasion → permanent is allowed, shared or not, unless
 * the stored event date is still upcoming, because gifters may be preparing for that event under
 * the strict rules; reservations and likes stay. Becoming permanent clears the event date and its
 * lock; a shared list becoming an occasion opens a fresh event-date window, since gifters never
 * relied on a date it did not have.
 */
function planWishlistKindChange(
	wishlistRow: Pick<WishlistRow, 'kind' | 'sharedAt' | 'eventDate'>,
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
	if (hasUpcomingEventDate(wishlistRow.eventDate, now)) {
		error(409, SERVER_ERROR.CANNOT_MAKE_WISHLIST_WITH_UPCOMING_EVENT_PERMANENT);
	}
	return { kind: requestedKind, eventDate: null, eventDateEditedAt: null };
}

export interface RequestedOccasion {
	kind?: WishlistKind;
	occasion?: WishlistOccasion;
}

/**
 * The kind and occasion a write asks for, or null when it names neither. A write naming only the
 * kind keeps its meaning and moves the occasion by {@link occasionAfterKindWrite}; an occasion
 * alone decides the kind; both together must agree.
 */
export function resolveRequestedOccasion(
	requested: RequestedOccasion,
	currentOccasion: WishlistOccasion | null,
): { kind: WishlistKind; occasion: WishlistOccasion } | null {
	if (requested.occasion === undefined) {
		return requested.kind === undefined
			? null
			: {
					kind: requested.kind,
					occasion: occasionAfterKindWrite(requested.kind, currentOccasion),
				};
	}
	const kind = wishlistKindForOccasion(requested.occasion);
	if (requested.kind !== undefined && requested.kind !== kind) {
		error(400, SERVER_ERROR.WISHLIST_OCCASION_KIND_MISMATCH);
	}
	return { kind, occasion: requested.occasion };
}

/** An occasion change, with the kind change it implies under that change's rules. */
export function planWishlistOccasionChange(
	wishlistRow: Pick<WishlistRow, 'kind' | 'occasion' | 'sharedAt' | 'eventDate'>,
	requested: RequestedOccasion,
	now: Date,
): Partial<Pick<WishlistRow, 'kind' | 'occasion' | 'eventDate' | 'eventDateEditedAt'>> {
	const resolved = resolveRequestedOccasion(requested, wishlistRow.occasion);
	if (resolved === null) {
		return {};
	}
	return {
		...planWishlistKindChange(wishlistRow, resolved.kind, now),
		...(resolved.occasion === wishlistRow.occasion ? {} : { occasion: resolved.occasion }),
	};
}
