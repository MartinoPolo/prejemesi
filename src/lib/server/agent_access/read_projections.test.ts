import { describe, expect, it, vi } from 'vitest';
import type { GiftForRecipient, GiftForVisitor } from '$lib/modules/gifts/types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	REVERT_CAPABILITY,
	RESERVATION_RELEASE_CAPABILITY,
} from '$lib/modules/wishlists/wishlist_capabilities.js';
import type { readWishlistOperation } from '$lib/server/operations/wishlist_read_operations.js';
import type { GiftRevisionSnapshot } from '$lib/server/operations/gift_revision_snapshot.js';
import type { WishlistBackground } from '$lib/theme/wishlist_themes.js';
import {
	projectAgentBulkCopyDestinations,
	projectAgentGiftSnapshot,
	projectAgentWishlist,
	projectAgentWishlistRow,
	projectAgentWishlistGifts,
} from './read_projections.js';

// The shipped library is empty until images are generated.
vi.mock('$lib/theme/wishlist_background_library.json', () => ({
	default: [{ id: 'minimal-photo', themeId: 'minimal', variant: 'photo', widths: [1280] }],
}));

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
	categoryIds: [],
	categories: [],
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
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: { mode: 'custom', imageKey: 'wishlists/backgrounds/owned.webp' },
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

	function projectRowWithBackground(background: Partial<WishlistBackground> | null) {
		return projectAgentWishlistRow({
			id: 'wishlist-1',
			shortId: 'short-1',
			recipientName: null,
			title: 'Seznam',
			description: null,
			eventDate: null,
			status: 'draft',
			kind: 'occasion',
			palette: 'graphite',
			themeId: 'minimal',
			styleTokens: null,
			background,
			imageKey: null,
			recipientIsModerator: false,
			sharedAt: null,
			archivedAt: null,
			createdAt,
			updatedAt: createdAt,
		});
	}

	it('exposes the id of a stored library background', () => {
		expect(
			projectRowWithBackground({ mode: 'library', libraryImageId: 'minimal-photo' }),
		).toMatchObject({ backgroundMode: 'library', backgroundLibraryImageId: 'minimal-photo' });
	});

	it('drops a library image that left the library, so the mode no longer reads as library', () => {
		expect(
			projectRowWithBackground({ mode: 'library', libraryImageId: 'minimal-retired' }),
		).toMatchObject({ backgroundMode: 'theme', backgroundLibraryImageId: null });
	});

	it('exposes the theme and resolved look without the custom background storage key', () => {
		const projected = projectAgentWishlistRow({
			id: 'wishlist-1',
			shortId: 'short-1',
			recipientName: null,
			title: 'Seznam',
			description: null,
			eventDate: null,
			status: 'draft',
			kind: 'occasion',
			palette: 'graphite',
			themeId: 'minimal',
			styleTokens: { corners: 'round' },
			background: { mode: 'custom', imageKey: 'wishlists/backgrounds/owned.webp' },
			imageKey: null,
			recipientIsModerator: false,
			sharedAt: null,
			archivedAt: null,
			createdAt,
			updatedAt: createdAt,
		});

		expect(projected).toMatchObject({
			themeId: 'minimal',
			style: { corners: 'round', border: 'fine', mat: 'white', heading: 'plain' },
			backgroundMode: 'custom',
			backgroundLibraryImageId: null,
		});
		expect(projected).not.toHaveProperty('styleTokens');
		expect(projected).not.toHaveProperty('background');
		expect(JSON.stringify(projected)).not.toContain('wishlists/backgrounds/');
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

describe('agent gift categories', () => {
	const sport = {
		id: 'category-sport',
		presetKey: null,
		customLabel: 'Sport',
		color: '#0369A1',
		sortOrder: 1,
	};
	const outdoor = {
		id: 'category-outdoor',
		presetKey: null,
		customLabel: 'Venku',
		color: '#047857',
		sortOrder: 0,
	};

	it('lists every category of a gift in its order, primary first', () => {
		const projected = projectAgentWishlistGifts(
			{
				role: WISHLIST_ROLES.recipient,
				gifts: [
					{
						...recipientGift,
						categoryIds: [sport.id, outdoor.id],
						categories: [sport, outdoor],
					},
				],
			},
			{ includeReserverNames: false },
		);

		expect(projected.gifts[0]).toMatchObject({
			categoryIds: [sport.id, outdoor.id],
			categories: [sport, outdoor],
		});
	});

	function revisionSnapshot(
		categories: { categoryIds: string[] } | { categoryId: string | null },
	): GiftRevisionSnapshot {
		return {
			name: 'Kolo',
			description: null,
			descriptionAppends: [],
			links: [],
			price: null,
			priceMax: null,
			currency: null,
			imageUrl: null,
			imageKey: null,
			imageMeta: null,
			quantity: 1,
			priorityLevelId: null,
			received: false,
			deletedAt: null,
			editedAfterShareAt: null,
			preEditShareSnapshot: null,
			...categories,
		} as GiftRevisionSnapshot;
	}

	it('reads a revision snapshot stored with the single categoryId as a category list', () => {
		expect(
			projectAgentGiftSnapshot(revisionSnapshot({ categoryId: sport.id })).categoryIds,
		).toEqual([sport.id]);
		expect(
			projectAgentGiftSnapshot(revisionSnapshot({ categoryId: null })).categoryIds,
		).toEqual([]);
	});

	it('keeps a current snapshot’s category list in order', () => {
		expect(
			projectAgentGiftSnapshot(revisionSnapshot({ categoryIds: [outdoor.id, sport.id] }))
				.categoryIds,
		).toEqual([outdoor.id, sport.id]);
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
