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

		expect(states.map((state) => state.presentation.overlay[0]?.kind)).toEqual([
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

		expect(overlay).toEqual([
			{ kind: 'own-reservation', role: 'primary' },
			{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
		]);
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

		expect(state.presentation.overlay).toEqual([
			{ kind: 'received', role: 'primary' },
			{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
		]);
		expect(state.presentation.otherReservers).toBeUndefined();
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

		expect(state.presentation.overlay).toEqual([{ kind: 'received', role: 'primary' }]);
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

		expect(received).toEqual([
			{ kind: 'received', role: 'primary' },
			{ kind: 'unavailable', role: 'support' },
		]);
		expect(unreceived).toEqual([{ kind: 'unavailable', role: 'primary' }]);
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
			[{ kind: 'partial', remaining: 2, total: 3, role: 'primary' }],
			[{ kind: 'unavailable', role: 'primary' }],
			[],
		]);
	});
});

describe('deriveGiftDisplayState bought state', () => {
	const purchasedAt = new Date('2026-02-01T00:00:00Z');

	it('shows a reserver their own bought reservation instead of the plain reservation', () => {
		const overlay = deriveGiftDisplayState(
			gift({
				reservedCount: 1,
				isFullyReserved: true,
				myReservationId: 'mine',
				myReservationPurchasedAt: purchasedAt,
			}),
			'visitor',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(overlay).toEqual([{ kind: 'own-purchased', role: 'primary' }]);
	});

	it('keeps remaining capacity and Received around the bought state', () => {
		const purchased = gift({
			quantity: 3,
			reservedCount: 1,
			myReservationId: 'mine',
			myReservationPurchasedAt: purchasedAt,
		});

		expect(
			deriveGiftDisplayState(purchased, 'moderator', false, visitorCapabilities).presentation
				.overlay,
		).toEqual([
			{ kind: 'own-purchased', role: 'primary' },
			{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
		]);
		expect(
			deriveGiftDisplayState(
				{ ...purchased, received: true },
				'visitor',
				false,
				visitorCapabilities,
			).presentation.overlay,
		).toEqual([
			{ kind: 'received', role: 'primary' },
			{ kind: 'own-purchased', role: 'support' },
		]);
	});

	it('never shows purchase state to a recipient, even a self-promoted one', () => {
		const state = deriveGiftDisplayState(
			gift({
				quantity: 3,
				reservedCount: 3,
				isFullyReserved: true,
				myReservationId: 'private',
				myReservationPurchasedAt: purchasedAt,
			}),
			'recipient',
			false,
			{ canLike: false },
		);

		expect(state.presentation.overlay).toEqual([{ kind: 'unavailable', role: 'primary' }]);
		expect(state.reservationAwareGift?.myReservationPurchasedAt).toBeNull();
	});
});

describe('deriveGiftDisplayState reserver identity', () => {
	it('names a single other reserver only for viewers allowed to see names', () => {
		const reservedByJana = gift({
			reservedCount: 1,
			isFullyReserved: true,
			reserverNames: ['Jana'],
		});

		expect(
			deriveGiftDisplayState(reservedByJana, 'moderator', false, visitorCapabilities)
				.presentation.overlay,
		).toEqual([
			{
				kind: 'unavailable',
				otherReservers: { kind: 'single', name: 'Jana' },
				role: 'primary',
			},
		]);
		expect(
			deriveGiftDisplayState(reservedByJana, 'visitor', false, visitorCapabilities)
				.presentation.overlay,
		).toEqual([{ kind: 'unavailable', role: 'primary' }]);
		expect(
			deriveGiftDisplayState(reservedByJana, 'recipient', false, { canLike: false })
				.presentation.overlay,
		).toEqual([{ kind: 'unavailable', role: 'primary' }]);
	});

	it('summarises several other reservers without listing names', () => {
		const overlay = deriveGiftDisplayState(
			gift({ quantity: 3, reservedCount: 2, reserverNames: ['Jana', 'Eva'] }),
			'moderator',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(overlay).toEqual([
			{ kind: 'partial', remaining: 1, total: 3, role: 'primary' },
			{
				kind: 'unavailable',
				otherReservers: { kind: 'multiple' },
				role: 'other-reservation',
			},
		]);
	});

	it('never names the viewer to themselves', () => {
		const ownOnly = deriveGiftDisplayState(
			gift({
				quantity: 3,
				reservedCount: 1,
				myReservationId: 'mine',
				reserverNames: ['Petr'],
			}),
			'moderator',
			false,
			visitorCapabilities,
		).presentation.overlay;
		const ownAndOther = deriveGiftDisplayState(
			gift({
				quantity: 3,
				reservedCount: 2,
				myReservationId: 'mine',
				reserverNames: ['Petr', 'Jana'],
			}),
			'moderator',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(ownOnly).toEqual([
			{ kind: 'own-reservation', role: 'primary' },
			{ kind: 'partial', remaining: 2, total: 3, role: 'support' },
		]);
		expect(ownAndOther.at(-1)).toEqual({
			kind: 'unavailable',
			otherReservers: { kind: 'multiple' },
			role: 'other-reservation',
		});
	});
});

describe('deriveGiftDisplayState other-reservation entry', () => {
	it('names a single other reserver of a partly reserved gift in its own entry', () => {
		const presentation = deriveGiftDisplayState(
			gift({ quantity: 3, reservedCount: 1, reserverNames: ['Jana'] }),
			'moderator',
			false,
			visitorCapabilities,
		).presentation;

		expect(presentation.otherReservers).toEqual({ kind: 'single', name: 'Jana' });
		expect(presentation.overlay.at(-1)).toEqual({
			kind: 'unavailable',
			otherReservers: { kind: 'single', name: 'Jana' },
			role: 'other-reservation',
		});
	});

	it('adds no other-reservation entry for viewers who may not see names', () => {
		const presentation = deriveGiftDisplayState(
			gift({ quantity: 3, reservedCount: 2, reserverNames: ['Jana', 'Eva'] }),
			'visitor',
			false,
			visitorCapabilities,
		).presentation;

		expect(presentation.otherReservers).toBeUndefined();
		expect(presentation.overlay.map((entry) => entry.role)).toEqual(['primary']);
	});

	it('keeps names on the Received group support badge without a duplicate entry', () => {
		const overlay = deriveGiftDisplayState(
			gift({
				received: true,
				reservedCount: 1,
				isFullyReserved: true,
				reserverNames: ['Jana'],
			}),
			'moderator',
			false,
			visitorCapabilities,
		).presentation.overlay;

		expect(overlay).toEqual([
			{ kind: 'received', role: 'primary' },
			{
				kind: 'unavailable',
				otherReservers: { kind: 'single', name: 'Jana' },
				role: 'support',
			},
		]);
	});
});
