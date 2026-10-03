import { describe, expect, it } from 'vitest';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { deriveGiftBrowseActions, type GiftBrowseActionInput } from './gift_browse_actions.js';
import type { GiftForVisitor } from './types.js';

function makeVisitorGift(myReservationId: string | null): GiftForVisitor {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Kolo',
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
		createdAt: new Date('2026-01-01'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: myReservationId === null ? 0 : 1,
		isFullyReserved: myReservationId !== null,
		reserverNames: [],
		myReservationId,
		myReservationPurchasedAt: null,
	};
}

const ownReservationManager: GiftBrowseActionInput = {
	role: WISHLIST_ROLES.moderator,
	visitorGift: makeVisitorGift('reservation-1'),
	isFullyReserved: true,
	isArchived: false,
	isAuthenticated: true,
	contextualMode: false,
	canMarkReceived: true,
};

describe('deriveGiftBrowseActions', () => {
	it('keeps Bought beside Received for a manager holding their own reservation', () => {
		expect(deriveGiftBrowseActions(ownReservationManager)).toEqual({
			primaryAction: 'cancel-reservation',
			secondaryActions: ['purchased', 'received'],
		});
	});

	it('hides Bought on an archived list while keeping own cancellation', () => {
		expect(
			deriveGiftBrowseActions({
				...ownReservationManager,
				role: WISHLIST_ROLES.visitor,
				isArchived: true,
			}),
		).toEqual({ primaryAction: 'cancel-reservation', secondaryActions: [] });
	});

	it('hides Bought from a signed-out reserver', () => {
		expect(
			deriveGiftBrowseActions({
				...ownReservationManager,
				role: WISHLIST_ROLES.visitor,
				isAuthenticated: false,
			}),
		).toEqual({ primaryAction: 'cancel-reservation', secondaryActions: [] });
	});

	it('offers Reserve alone to a visitor without a reservation', () => {
		expect(
			deriveGiftBrowseActions({
				...ownReservationManager,
				role: WISHLIST_ROLES.visitor,
				visitorGift: makeVisitorGift(null),
				isFullyReserved: false,
			}),
		).toEqual({ primaryAction: 'reserve', secondaryActions: [] });
	});

	it('makes Received primary for a recipient who cannot reserve', () => {
		expect(
			deriveGiftBrowseActions({
				...ownReservationManager,
				role: WISHLIST_ROLES.recipient,
				visitorGift: null,
			}),
		).toEqual({ primaryAction: 'received', secondaryActions: [] });
	});
});
