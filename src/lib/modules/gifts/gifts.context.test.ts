import { getDomain } from 'tldts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLocale, overwriteGetLocale } from '$lib/paraglide/runtime.js';
import type { GiftForVisitor } from './types.js';
import {
	emptyGiftFilters,
	giftMatchesFacetFilters,
	giftStoreFilterOptions,
	shouldApplyLikedOnly,
	wishlistGiftGroupingStorageKey,
	wishlistGiftSortStorageKey,
} from './gifts.context.svelte.js';
import {
	NO_LINK_GIFT_STORE_FILTER_VALUE,
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
		images: [],
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryIds: [],
		categories: [],
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** The gift's ordered categories; the first is primary. */
function inCategories(...categoryIds: string[]): Partial<GiftForVisitor> {
	return {
		categoryIds,
		categories: categoryIds.map((id, sortOrder) => ({
			id,
			presetKey: null,
			customLabel: id,
			color: '#2563EB',
			sortOrder,
		})),
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
					...inCategories('category-books'),
					priorityLevelId: 'priority-high',
					prioritySortOrder: 0,
				}),
				filters,
				getDomain,
			),
		).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift({
					...inCategories('category-toys'),
					priorityLevelId: 'priority-low',
					prioritySortOrder: 1,
				}),
				filters,
				getDomain,
			),
		).toBe(false);
	});

	it('matches a gift through any of its categories, not only the primary', () => {
		const gift = makeGift(inCategories('category-books', 'category-toys', 'category-games'));
		const filterBy = (...categoryValues: string[]) => ({
			...emptyGiftFilters(),
			categoryValues,
		});

		expect(giftMatchesFacetFilters(gift, filterBy('category-books'), getDomain)).toBe(true);
		expect(giftMatchesFacetFilters(gift, filterBy('category-games'), getDomain)).toBe(true);
		expect(
			giftMatchesFacetFilters(gift, filterBy('category-music', 'category-toys'), getDomain),
		).toBe(true);
		expect(giftMatchesFacetFilters(gift, filterBy('category-music'), getDomain)).toBe(false);
		expect(
			giftMatchesFacetFilters(
				gift,
				filterBy(UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE),
				getDomain,
			),
		).toBe(false);
	});

	it('matches explicit uncategorized and no-priority sentinels', () => {
		const filters = {
			...emptyGiftFilters(),
			categoryValues: [UNCATEGORIZED_GIFT_CATEGORY_FILTER_VALUE],
			priorityValues: [NO_PRIORITY_GIFT_PRIORITY_FILTER_VALUE],
		};

		expect(giftMatchesFacetFilters(makeGift(), filters, getDomain)).toBe(true);
		expect(
			giftMatchesFacetFilters(makeGift(inCategories('category-books')), filters, getDomain),
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
			storeValues: [],
		});
	});
});

/** A gift linking to each URL, in order. */
function linkingTo(...urls: string[]): Partial<GiftForVisitor> {
	return { links: urls.map((url) => ({ url })) };
}

describe('store facet options (issue #650)', () => {
	const originalGetLocale = getLocale;
	beforeEach(() => overwriteGetLocale(() => 'cs'));
	afterEach(() => overwriteGetLocale(originalGetLocale));

	it('lists each store by gift count, then alphabetically, merging subdomains and counting a gift once', () => {
		const options = giftStoreFilterOptions(
			[
				makeGift({
					id: 'a',
					...linkingTo('https://www.alza.cz/a', 'https://www.datart.cz/a'),
				}),
				makeGift({ id: 'b', ...linkingTo('https://eshop.decathlon.cz/b') }),
				makeGift({
					id: 'c',
					...linkingTo('https://www.decathlon.cz/c', 'https://decathlon.cz/d'),
				}),
				makeGift({ id: 'd', ...linkingTo('https://www.datart.cz/d') }),
				makeGift({ id: 'e', ...linkingTo('https://www.kosmas.cz/e') }),
			],
			getDomain,
		);

		expect(options).toEqual([
			{ value: 'datart.cz', label: 'datart.cz' },
			{ value: 'decathlon.cz', label: 'decathlon.cz' },
			{ value: 'alza.cz', label: 'alza.cz' },
			{ value: 'kosmas.cz', label: 'kosmas.cz' },
		]);
	});

	it('adds "Bez odkazu" last only when some gift has no link', () => {
		const withLinkless = giftStoreFilterOptions(
			[
				makeGift({ id: 'a' }),
				makeGift({ id: 'b', ...linkingTo('https://www.alza.cz/b') }),
				makeGift({ id: 'c', ...linkingTo('https://www.alza.cz/c') }),
			],
			getDomain,
		);
		expect(withLinkless).toEqual([
			{ value: 'alza.cz', label: 'alza.cz' },
			{ value: NO_LINK_GIFT_STORE_FILTER_VALUE, label: 'Bez odkazu' },
		]);

		const allLinked = giftStoreFilterOptions(
			[
				makeGift({ id: 'a', ...linkingTo('https://www.alza.cz/a') }),
				makeGift({ id: 'b', ...linkingTo('https://www.datart.cz/b') }),
			],
			getDomain,
		);
		expect(allLinked.map((option) => option.value)).not.toContain(
			NO_LINK_GIFT_STORE_FILTER_VALUE,
		);
	});

	it('offers no options when there would be fewer than two', () => {
		expect(giftStoreFilterOptions([], getDomain)).toEqual([]);
		expect(
			giftStoreFilterOptions(
				[
					makeGift({ id: 'a', ...linkingTo('https://www.alza.cz/a') }),
					makeGift({ id: 'b', ...linkingTo('https://m.alza.cz/b') }),
				],
				getDomain,
			),
		).toEqual([]);
		expect(
			giftStoreFilterOptions([makeGift({ id: 'a' }), makeGift({ id: 'b' })], getDomain),
		).toEqual([]);
	});
});

describe('store facet matching (issue #650)', () => {
	const filterByStores = (...storeValues: string[]) => ({ ...emptyGiftFilters(), storeValues });

	it('matches a gift through any of its links, not only the primary one', () => {
		const gift = makeGift(linkingTo('https://www.alza.cz/a', 'https://eshop.decathlon.cz/a'));

		expect(giftMatchesFacetFilters(gift, filterByStores('alza.cz'), getDomain)).toBe(true);
		expect(giftMatchesFacetFilters(gift, filterByStores('decathlon.cz'), getDomain)).toBe(true);
		expect(giftMatchesFacetFilters(gift, filterByStores('datart.cz'), getDomain)).toBe(false);
	});

	it('leaves the store facet inactive until the store resolver is available', () => {
		const gift = makeGift(linkingTo('https://www.alza.cz/a'));

		expect(giftMatchesFacetFilters(gift, filterByStores('datart.cz'), null)).toBe(true);
	});

	it('uses OR within the store facet', () => {
		const filters = filterByStores('datart.cz', 'kosmas.cz');

		expect(
			giftMatchesFacetFilters(
				makeGift(linkingTo('https://www.kosmas.cz/a')),
				filters,
				getDomain,
			),
		).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift(linkingTo('https://www.alza.cz/a')),
				filters,
				getDomain,
			),
		).toBe(false);
	});

	it('selects exactly the gifts without links through "Bez odkazu"', () => {
		const filters = filterByStores(NO_LINK_GIFT_STORE_FILTER_VALUE);

		expect(giftMatchesFacetFilters(makeGift(), filters, getDomain)).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift(linkingTo('https://www.alza.cz/a')),
				filters,
				getDomain,
			),
		).toBe(false);
	});

	it('requires the category facet to match too (AND across facets)', () => {
		const filters = {
			...emptyGiftFilters(),
			storeValues: ['alza.cz'],
			categoryValues: ['category-books'],
		};

		expect(
			giftMatchesFacetFilters(
				makeGift({
					...linkingTo('https://www.alza.cz/a'),
					...inCategories('category-books'),
				}),
				filters,
				getDomain,
			),
		).toBe(true);
		expect(
			giftMatchesFacetFilters(
				makeGift({
					...linkingTo('https://www.alza.cz/a'),
					...inCategories('category-toys'),
				}),
				filters,
				getDomain,
			),
		).toBe(false);
		expect(
			giftMatchesFacetFilters(
				makeGift({
					...linkingTo('https://www.datart.cz/a'),
					...inCategories('category-books'),
				}),
				filters,
				getDomain,
			),
		).toBe(false);
	});
});
