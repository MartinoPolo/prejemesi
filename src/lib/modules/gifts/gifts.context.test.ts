import { describe, expect, it } from 'vitest';
import type { GiftForVisitor } from './types.js';
import {
	emptyGiftFilters,
	giftMatchesFacetFilters,
	shouldApplyLikedOnly,
	wishlistGiftGroupingStorageKey,
	wishlistGiftSortStorageKey,
} from './gifts.context.svelte.js';
import {
	NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE,
	UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE,
} from './types.js';

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
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
		categoryId: null,
		category: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

describe('liked-only presentation filtering', () => {
	it('ignores the active preference for recipients and resumes it when the role is restored', () => {
		const likedOnly = true;

		expect(shouldApplyLikedOnly(likedOnly, 'visitor')).toBe(true);
		expect(shouldApplyLikedOnly(likedOnly, 'recipient')).toBe(false);
		expect(shouldApplyLikedOnly(likedOnly, 'moderator')).toBe(true);
		expect(shouldApplyLikedOnly(likedOnly, 'visitor')).toBe(true);
	});
});

describe('facet gift filters (issue #246)', () => {
	it('uses OR within one facet and AND across category and priority facets', () => {
		const filters = {
			...emptyGiftFilters(),
			categoryValues: ['category-books', 'category-toys'],
			priorityValues: ['priority-high'],
		};

		expect(
			giftMatchesFacetFilters(
				makeGift({
					categoryId: 'category-books',
					category: {
						id: 'category-books',
						presetKey: null,
						customLabel: 'Knihy',
						color: '#2563EB',
						sortOrder: 0,
					},
					priorityLevelId: 'priority-high',
					prioritySortOrder: 0,
				}),
				filters,
			),
		).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift({
					categoryId: 'category-toys',
					category: {
						id: 'category-toys',
						presetKey: null,
						customLabel: 'Hračky',
						color: '#2563EB',
						sortOrder: 1,
					},
					priorityLevelId: 'priority-low',
					prioritySortOrder: 1,
				}),
				filters,
			),
		).toBe(false);
	});

	it('matches explicit uncategorized and no-priority sentinels', () => {
		const filters = {
			...emptyGiftFilters(),
			categoryValues: [UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE],
			priorityValues: [NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE],
		};

		expect(giftMatchesFacetFilters(makeGift(), filters)).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift({
					categoryId: 'category-books',
					category: {
						id: 'category-books',
						presetKey: null,
						customLabel: 'Knihy',
						color: '#2563EB',
						sortOrder: 0,
					},
				}),
				filters,
			),
		).toBe(false);
	});

	it('uses per-wishlist storage keys for sort and grouping while filters stay plain state', () => {
		expect(wishlistGiftSortStorageKey('wishlist-a')).toBe(
			'prejemesi-wishlist:wishlist-a:gift-sort',
		);
		expect(wishlistGiftSortStorageKey('wishlist-b')).toBe(
			'prejemesi-wishlist:wishlist-b:gift-sort',
		);
		expect(wishlistGiftGroupingStorageKey('wishlist-a')).toBe(
			'prejemesi-wishlist:wishlist-a:gift-grouping',
		);
		expect(emptyGiftFilters()).toEqual({
			availableOnly: false,
			withLinkOnly: false,
			likedOnly: false,
			showReceived: false,
			categoryValues: [],
			priorityValues: [],
		});
	});
});
