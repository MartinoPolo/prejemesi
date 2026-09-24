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

	it('keeps own reservation and remaining finite capacity as distinct pills', () => {
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

	it('shows counts to a self-promoted recipient without enabling visitor actions or identities', () => {
		const state = deriveGiftDisplayState(
			gift({
				received: true,
				quantity: 3,
				reservedCount: 1,
				reserverNames: ['Private reserver'],
			}),
			'recipient',
			false,
			{ canLike: false },
		);

		expect(state.presentation.overlay).toEqual({
			kind: 'received',
			supportKind: 'partial',
			remaining: 2,
			total: 3,
		});
		expect(state.isVisitorOrModerator).toBe(false);
		expect(state.visitorGift).toBeNull();
		expect(state.reservationAwareGift).not.toBeNull();
		expect(state.reservationAwareGift?.reserverNames).toEqual([]);
		expect(state.reservationAwareGift?.myReservationId).toBeNull();
		expect(state.presentation.showLike).toBe(false);
	});

	it('ignores every reservation field when recipient privacy is enabled', () => {
		const state = deriveGiftDisplayState(
			gift({
				received: true,
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: 'private',
				reserverNames: ['Private reserver'],
			}),
			'recipient',
			true,
			{ canLike: false },
		);

		expect(state.presentation.overlay).toEqual({ kind: 'received' });
		expect(state.reservationAwareGift).toBeNull();
		expect(state.reservedCount).toBe(0);
		expect(state.isFullyReserved).toBe(false);
	});

	it('reveals the preserved reservation pill when Received is removed', () => {
		const reservedGift = gift({
			received: true,
			quantity: 3,
			reservedCount: 3,
			isFullyReserved: true,
		});
		const received = deriveGiftDisplayState(reservedGift, 'visitor', false, visitorCapabilities)
			.presentation.overlay;
		const unreceived = deriveGiftDisplayState(
			{ ...reservedGift, received: false },
			'visitor',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(received).toEqual({ kind: 'received', supportKind: 'unavailable' });
		expect(unreceived).toEqual({ kind: 'unavailable' });
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
