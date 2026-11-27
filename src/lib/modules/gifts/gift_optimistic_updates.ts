import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
import { withGiftCategoryIds } from './gift_grouped_reorder.js';
import type { GiftByRole, GiftForVisitor } from './types.js';

// Optimistic projections of the gift and ledger query results. Each returns a new result (or the
// unchanged one when the target is gone, because a refresh already settled it) and never mutates.

interface GiftsQueryResult {
	readonly gifts: readonly GiftByRole[];
}

interface ReservationLedgerResult {
	readonly reservationsByGiftId: Record<string, ReservationForModerator[]>;
}

interface OptimisticPriorityLevel {
	id: string;
	label: string;
	sortOrder: number;
}

function withUpdatedGift<Result extends GiftsQueryResult, Target extends GiftByRole>(
	result: Result,
	isTarget: (gift: GiftByRole) => gift is Target,
	update: (gift: Target) => Target,
): Result {
	if (!result.gifts.some(isTarget)) {
		return result;
	}
	return {
		...result,
		gifts: result.gifts.map((gift) => (isTarget(gift) ? update(gift) : gift)),
	};
}

function hasGiftId(giftId: string) {
	return (gift: GiftByRole): gift is GiftByRole => gift.id === giftId;
}

function holdsReservation(reservationId: string) {
	return (gift: GiftByRole): gift is GiftForVisitor =>
		'myReservationId' in gift && gift.myReservationId === reservationId;
}

/** The names without one occurrence of `name`; two reservers may share a display name. */
function withoutFirstName(names: readonly string[], name: string | null): string[] {
	const index = name === null ? -1 : names.indexOf(name);
	return index === -1 ? [...names] : [...names.slice(0, index), ...names.slice(index + 1)];
}

/**
 * The gifts without the viewer's cancelled reservation. `viewerName` is the signed-in viewer's
 * display name, removed from the reserver names správci see.
 */
export function withoutViewerReservation<Result extends GiftsQueryResult>(
	result: Result,
	reservationId: string,
	viewerName: string | null,
): Result {
	return withUpdatedGift(result, holdsReservation(reservationId), (gift) => {
		const reservedCount = Math.max(0, gift.reservedCount - gift.myReservationQuantity);
		// A reservation made on a linked copy counts toward that copy's units and names.
		const reservedOnLinkedCopy = gift.myReservationOnLinkedCopy;
		return {
			...gift,
			reservedCount,
			isFullyReserved: reservedCount >= (gift.quantity ?? 1),
			reserverNames: reservedOnLinkedCopy
				? gift.reserverNames
				: withoutFirstName(gift.reserverNames, viewerName),
			reservedOnLinkedCopiesCount: reservedOnLinkedCopy
				? Math.max(0, gift.reservedOnLinkedCopiesCount - gift.myReservationQuantity)
				: gift.reservedOnLinkedCopiesCount,
			myReservationId: null,
			myReservationPurchasedAt: null,
			myReservationQuantity: 0,
			myReservationOnLinkedCopy: false,
		};
	});
}

export function withoutLedgerReservation<Result extends ReservationLedgerResult>(
	result: Result,
	reservationId: string,
): Result {
	const entry = Object.entries(result.reservationsByGiftId).find(([, reservations]) =>
		reservations.some((reservation) => reservation.id === reservationId),
	);
	if (entry === undefined) {
		return result;
	}
	const [giftId, reservations] = entry;
	return {
		...result,
		reservationsByGiftId: {
			...result.reservationsByGiftId,
			[giftId]: reservations.filter((reservation) => reservation.id !== reservationId),
		},
	};
}

export function withGiftPriority<Result extends GiftsQueryResult>(
	result: Result,
	giftId: string,
	priorityLevel: OptimisticPriorityLevel | null,
): Result {
	return withUpdatedGift(result, hasGiftId(giftId), (gift) => ({
		...gift,
		priorityLevelId: priorityLevel?.id ?? null,
		priorityLabel: priorityLevel?.label ?? null,
		prioritySortOrder: priorityLevel?.sortOrder ?? null,
	}));
}

export function withGiftCategories<Result extends GiftsQueryResult>(
	result: Result,
	giftId: string,
	categoryIds: readonly string[],
	wishlistCategories: readonly PublicGiftCategory[],
): Result {
	return withUpdatedGift(result, hasGiftId(giftId), (gift) =>
		withGiftCategoryIds(gift, categoryIds, wishlistCategories),
	);
}
