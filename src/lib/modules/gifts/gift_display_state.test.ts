import { describe, expect, it } from 'vitest';
import type { GiftForVisitor } from './types.js';
import { deriveGiftDisplayState } from './gift_display_state.js';

function gift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Gift',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

const visitorCapabilities = { canLike: true };

describe('deriveGiftDisplayState presentation', () => {
	it('gates Like by capability and archive state', () => {
		expect(
			deriveGiftDisplayState(gift(), 'visitor', false, { canLike: true }).presentation
				.showLike,
		).toBe(true);
		expect(
			deriveGiftDisplayState(gift(), 'visitor', false, { canLike: false }).presentation
				.showLike,
		).toBe(false);
		expect(
			deriveGiftDisplayState(gift(), 'visitor', false, {
				canLike: true,
				isArchived: true,
			}).presentation.showLike,
		).toBe(false);
	});

	it('dims fully reserved and received gifts', () => {
		expect(
			deriveGiftDisplayState(
				gift({ isFullyReserved: true, reservedCount: 1 }),
				'visitor',
				false,
				visitorCapabilities,
			).presentation.isDimmed,
		).toBe(true);
		expect(
			deriveGiftDisplayState(gift({ received: true }), 'visitor', false, visitorCapabilities)
				.presentation.isDimmed,
		).toBe(true);
	});

	it('prevents hidden reservation state and contextual presentation from dimming', () => {
		const fullyReserved = gift({ isFullyReserved: true, reservedCount: 1 });
		expect(
			deriveGiftDisplayState(fullyReserved, 'visitor', true, visitorCapabilities).presentation
				.isDimmed,
		).toBe(false);
		expect(
			deriveGiftDisplayState(
				gift({ received: true }),
				'visitor',
				true,
				visitorCapabilities,
				true,
			).presentation.isDimmed,
		).toBe(false);
	});

	it('applies received, own, unavailable, then partial state precedence', () => {
		const states = [
			gift({ received: true, quantity: 3, reservedCount: 1, myReservationId: 'mine' }),
			gift({ quantity: 3, reservedCount: 1, myReservationId: 'mine' }),
			gift({ quantity: 3, reservedCount: 3, isFullyReserved: true }),
			gift({ quantity: 3, reservedCount: 1 }),
		].map((value) => deriveGiftDisplayState(value, 'visitor', false, visitorCapabilities));

		expect(states.map((state) => state.presentation.overlay?.kind)).toEqual([
			'received',
			'own-reservation',
			'unavailable',
			'partial',
		]);
	});

	it('keeps own reservation primary and adds finite remaining capacity as support', () => {
		const overlay = deriveGiftDisplayState(
			gift({ quantity: 3, reservedCount: 1, myReservationId: 'mine' }),
			'visitor',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(overlay).toEqual({
			kind: 'own-reservation',
			supportKind: 'partial',
			remaining: 2,
			total: 3,
		});
	});

	it('exposes a remaining count only for finite capacity that is still available', () => {
		const overlays = [
			gift({ quantity: 3, reservedCount: 1 }),
			gift({ quantity: 3, reservedCount: 3, isFullyReserved: true }),
			gift({ quantity: null, reservedCount: 4 }),
		].map(
			(value) =>
				deriveGiftDisplayState(value, 'visitor', false, visitorCapabilities).presentation
					.overlay,
		);

		expect(overlays).toEqual([
			{ kind: 'partial', remaining: 2, total: 3 },
			{ kind: 'unavailable' },
			null,
		]);
	});
});
