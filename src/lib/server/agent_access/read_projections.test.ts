import { describe, expect, it } from 'vitest';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	REVERT_CAPABILITY,
	RESERVATION_RELEASE_CAPABILITY,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { readWishlistOperation } from '$lib/server/operations/wishlist_read_operations.js';
import {
	projectAgentBulkCopyDestinations,
	projectAgentWishlist,
	projectAgentWishlistGifts,
} from './read_projections.js';

type ReadWishlistOutput = Awaited<ReturnType<typeof readWishlistOperation.run>>;

const createdAt = new Date('2026-10-01T10:00:00Z');

const recipientGift: GiftForRecipient = {
	id: 'gift-1',
	wishlistId: 'wishlist-1',
	name: 'Kolo',
	description: null,
	descriptionAppends: [],
	editedAfterShareAt: null,
	links: [],
	price: 5000,
	priceMax: null,
	currency: 'CZK',
	imageUrl: null,
	imageKey: null,
	imageMeta: null,
	quantity: 1,
	sortOrder: 0,
	received: false,
	createdAt,
	priorityLevelId: null,
	priorityLabel: null,
	prioritySortOrder: null,
	categoryId: null,
	category: null,
};

const visitorGift: GiftForVisitor = {
	...recipientGift,
	likeCount: 2,
	reservedCount: 1,
	isFullyReserved: true,
	reserverNames: ['Petr Svoboda'],
	myReservationId: null,
	myReservationPurchasedAt: null,
};

const RESERVATION_AND_LIKE_FIELDS = [
	'likeCount',
	'reservedCount',
	'isFullyReserved',
	'reserverNames',
	'myReservationId',
	'myReservationPurchasedAt',
];

describe('projectAgentWishlist', () => {
	it('leaves out the demo session, recipient account id and other internal columns', () => {
		const wishlistOutput: ReadWishlistOutput = {
			id: 'wishlist-1',
			demoSessionId: 'demo-session',
			shortId: 'short-1',
			recipientUserId: 'recipient-user',
			recipientName: null,
			title: 'Vánoce',
			description: null,
			eventDate: null,
			status: 'active',
			kind: 'permanent',
			theme: 'default',
			customThemeColor: '#123456',
			palette: 'sky',
			imageKey: 'wishlists/banner.webp',
			imageSlots: null,
			recipientIsModerator: false,
			sharedAt: createdAt,
			firstSharedAt: createdAt,
			eventDateEditedAt: createdAt,
			archivedAt: null,
			deletedAt: null,
			createdAt,
			updatedAt: createdAt,
			recipientDisplayName: 'Martin Novák',
			recipientImage: null,
			managerNames: ['Jana'],
			role: WISHLIST_ROLES.moderator,
			revertCapability: REVERT_CAPABILITY.hidden,
			reservationReleaseCapability: RESERVATION_RELEASE_CAPABILITY.none,
		};

		const projected = projectAgentWishlist(wishlistOutput);

		for (const internalField of [
			'demoSessionId',
			'recipientUserId',
			'theme',
			'customThemeColor',
			'imageKey',
			'firstSharedAt',
			'eventDateEditedAt',
			'deletedAt',
			'revertCapability',
			'reservationReleaseCapability',
		]) {
			expect(projected).not.toHaveProperty(internalField);
		}
		expect(projected).toMatchObject({
			id: 'wishlist-1',
			shortId: 'short-1',
			title: 'Vánoce',
			recipientDisplayName: 'Martin Novák',
			managerNames: ['Jana'],
			role: WISHLIST_ROLES.moderator,
		});
		expect(projected.imageUrl).toContain('wishlists/banner.webp');
	});
});

describe('projectAgentWishlistGifts', () => {
	it('keeps reservation state and counts but drops reserver names without the identities scope', () => {
		const projected = projectAgentWishlistGifts(
			{ role: WISHLIST_ROLES.moderator, gifts: [visitorGift] },
			{ includeReserverNames: false },
		);
		expect(projected.gifts[0]).toMatchObject({
			reservedCount: 1,
			isFullyReserved: true,
			likeCount: 2,
		});
		expect(projected.gifts[0]).not.toHaveProperty('reserverNames');
	});

	it('includes reserver names with the identities scope', () => {
		const projected = projectAgentWishlistGifts(
			{ role: WISHLIST_ROLES.moderator, gifts: [visitorGift] },
			{ includeReserverNames: true },
		);
		expect(projected.gifts[0]).toMatchObject({ reserverNames: ['Petr Svoboda'] });
	});

	it('never passes on fields the projection does not list, such as a gifter email', () => {
		const giftWithEmail = { ...visitorGift, anonymousEmail: 'gifter@example.com' };
		const projected = projectAgentWishlistGifts(
			{ role: WISHLIST_ROLES.moderator, gifts: [giftWithEmail] },
			{ includeReserverNames: true },
		);
		expect(JSON.stringify(projected)).not.toContain('gifter@example.com');
	});

	it('returns the recipient shape without reservation or like data', () => {
		const projected = projectAgentWishlistGifts(
			{ role: WISHLIST_ROLES.recipient, gifts: [recipientGift] },
			{ includeReserverNames: true },
		);
		for (const field of RESERVATION_AND_LIKE_FIELDS) {
			expect(projected.gifts[0]).not.toHaveProperty(field);
		}
	});
});

describe('agent gift projection', () => {
	it('turns an uploaded image into its public URL and leaves out the storage key', () => {
		const projected = projectAgentWishlistGifts(
			{
				role: WISHLIST_ROLES.recipient,
				gifts: [{ ...recipientGift, imageKey: 'gifts/kolo.webp' }],
			},
			{ includeReserverNames: false },
		);
		expect(projected.gifts[0]).not.toHaveProperty('imageKey');
		expect(projected.gifts[0]?.imageUrl).toContain('gifts/kolo.webp');
	});
});

describe('projectAgentBulkCopyDestinations', () => {
	const destinations = [
		{
			id: 'allowed',
			title: 'A',
			status: 'draft' as const,
			kind: 'occasion' as const,
			recipientDisplayName: 'Martin',
		},
		{
			id: 'other',
			title: 'B',
			status: 'active' as const,
			kind: 'permanent' as const,
			recipientDisplayName: 'Jana',
		},
	];

	it('shows a restricted token only the wishlists it may reach', () => {
		expect(projectAgentBulkCopyDestinations(destinations, ['allowed'])).toEqual([
			destinations[0],
		]);
		expect(projectAgentBulkCopyDestinations(destinations, null)).toEqual(destinations);
	});
});
