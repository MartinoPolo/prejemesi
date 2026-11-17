import { describe, expect, it } from 'vitest';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { ReservationForModerator } from '$lib/modules/reservations/types.js';
import { makeGift } from './gift_ordering.test_fixtures.js';
import {
	withGiftCategories,
	withGiftPriority,
	withoutLedgerReservation,
	withoutViewerReservation,
} from './gift_optimistic_updates.js';

function giftsResult(...gifts: ReturnType<typeof makeGift>[]) {
	return { role: 'moderator', gifts } as const;
}

function ledgerReservation(id: string, giftId: string): ReservationForModerator {
	return {
		id,
		giftId,
		quantity: 1,
		displayName: 'Petr Svoboda',
		releasable: true,
		createdAt: new Date('2026-01-01T00:00:00Z'),
	};
}

describe('withoutViewerReservation', () => {
	it('frees the units the viewer held and clears their reservation', () => {
		const reserved = makeGift({
			quantity: 3,
			reservedCount: 3,
			isFullyReserved: true,
			reserverNames: ['Jana', 'Petr Svoboda'],
			myReservationId: 'reservation-1',
			myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
			myReservationQuantity: 2,
		});
		const other = makeGift();
		const before = giftsResult(reserved, other);

		const after = withoutViewerReservation(before, 'reservation-1', 'Petr Svoboda');

		expect(after.gifts[0]).toEqual({
			...reserved,
			reservedCount: 1,
			isFullyReserved: false,
			reserverNames: ['Jana'],
			myReservationId: null,
			myReservationPurchasedAt: null,
			myReservationQuantity: 0,
		});
		expect(after.gifts[1]).toBe(other);
		expect(after.role).toBe('moderator');
		expect(before.gifts[0]).toBe(reserved);
		expect(reserved.myReservationId).toBe('reservation-1');
	});

	it('frees only the units the viewer held when other gifters keep theirs', () => {
		const reserved = makeGift({
			quantity: 3,
			reservedCount: 3,
			isFullyReserved: true,
			myReservationId: 'reservation-1',
			myReservationQuantity: 1,
		});

		const [gift] = withoutViewerReservation(giftsResult(reserved), 'reservation-1', null).gifts;

		expect(gift).toMatchObject({ reservedCount: 2, isFullyReserved: false });
	});

	it('keeps a gift fully reserved when others still hold every unit of a lowered quantity', () => {
		const overReserved = makeGift({
			quantity: 2,
			reservedCount: 3,
			isFullyReserved: true,
			myReservationId: 'reservation-1',
			myReservationQuantity: 1,
		});

		const [gift] = withoutViewerReservation(
			giftsResult(overReserved),
			'reservation-1',
			null,
		).gifts;

		expect(gift).toMatchObject({ reservedCount: 2, isFullyReserved: true });
	});

	it('removes the viewer name only once when another reserver shares it', () => {
		const reserved = makeGift({
			quantity: 3,
			reservedCount: 2,
			reserverNames: ['Petr Svoboda', 'Jana', 'Petr Svoboda'],
			myReservationId: 'reservation-1',
			myReservationQuantity: 1,
		});

		const [gift] = withoutViewerReservation(
			giftsResult(reserved),
			'reservation-1',
			'Petr Svoboda',
		).gifts;

		expect(gift?.reserverNames).toEqual(['Jana', 'Petr Svoboda']);
	});

	it('leaves an already refreshed result untouched', () => {
		const before = giftsResult(makeGift({ myReservationId: null }));

		expect(withoutViewerReservation(before, 'reservation-1', 'Petr Svoboda')).toBe(before);
	});
});

describe('withoutLedgerReservation', () => {
	it('removes only the cancelled reservation', () => {
		const kept = ledgerReservation('reservation-2', 'gift-1');
		const before = {
			role: 'moderator',
			reservationsByGiftId: {
				'gift-1': [ledgerReservation('reservation-1', 'gift-1'), kept],
				'gift-2': [ledgerReservation('reservation-3', 'gift-2')],
			},
		};

		const after = withoutLedgerReservation(before, 'reservation-1');

		expect(after.reservationsByGiftId['gift-1']).toEqual([kept]);
		expect(after.reservationsByGiftId['gift-2']).toBe(before.reservationsByGiftId['gift-2']);
		expect(before.reservationsByGiftId['gift-1']).toHaveLength(2);
	});

	it('leaves the ledger untouched when the reservation is already gone', () => {
		const before = {
			reservationsByGiftId: { 'gift-1': [ledgerReservation('other', 'gift-1')] },
		};

		expect(withoutLedgerReservation(before, 'reservation-1')).toBe(before);
	});
});

describe('withGiftPriority', () => {
	it('sets the level id, label and sort order of one gift', () => {
		const target = makeGift();
		const other = makeGift();

		const after = withGiftPriority(giftsResult(target, other), target.id, {
			id: 'level-high',
			label: 'Vysoká',
			sortOrder: 0,
		});

		expect(after.gifts[0]).toEqual({
			...target,
			priorityLevelId: 'level-high',
			priorityLabel: 'Vysoká',
			prioritySortOrder: 0,
		});
		expect(after.gifts[1]).toBe(other);
	});

	it('clears all priority fields', () => {
		const target = makeGift({
			priorityLevelId: 'level-high',
			priorityLabel: 'Vysoká',
			prioritySortOrder: 0,
		});

		const [gift] = withGiftPriority(giftsResult(target), target.id, null).gifts;

		expect(gift).toMatchObject({
			priorityLevelId: null,
			priorityLabel: null,
			prioritySortOrder: null,
		});
	});
});

describe('withGiftCategories', () => {
	const books: PublicGiftCategory = {
		id: 'books',
		presetKey: null,
		customLabel: 'Knihy',
		color: 'blue',
		sortOrder: 0,
	};
	const toys: PublicGiftCategory = {
		...books,
		id: 'toys',
		customLabel: 'Hračky',
		sortOrder: 1,
	};

	it('assigns exactly the given categories resolved from the wishlist', () => {
		const target = makeGift({ categoryIds: ['books'], categories: [books] });

		const [gift] = withGiftCategories(
			giftsResult(target),
			target.id,
			['toys'],
			[books, toys],
		).gifts;

		expect(gift).toMatchObject({ categoryIds: ['toys'], categories: [toys] });
		expect(target.categoryIds).toEqual(['books']);
	});

	it('clears every category', () => {
		const target = makeGift({ categoryIds: ['books'], categories: [books] });

		const [gift] = withGiftCategories(giftsResult(target), target.id, [], [books]).gifts;

		expect(gift).toMatchObject({ categoryIds: [], categories: [] });
	});

	it('leaves the result untouched when the gift is gone', () => {
		const before = giftsResult(makeGift());

		expect(withGiftCategories(before, 'missing-gift', ['books'], [books])).toBe(before);
	});
});
