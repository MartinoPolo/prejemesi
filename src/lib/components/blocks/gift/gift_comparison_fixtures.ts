import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { GiftForVisitor } from '$lib/modules/gifts/types.js';

/** Painted local art so available/unavailable comparisons show a visible image fade. */
export const PAINTED_GIFT_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(
	"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='#9fd3f5'/><circle cx='320' cy='70' r='38' fill='#ffd166'/><path d='M0 230 Q110 150 220 220 T400 200 V300 H0Z' fill='#4caf6d'/><rect x='130' y='120' width='140' height='110' rx='8' fill='#e4572e'/><rect x='190' y='120' width='20' height='110' fill='#ffd166'/><rect x='120' y='100' width='160' height='30' rx='6' fill='#c2402a'/><rect x='190' y='100' width='20' height='30' fill='#f4b942'/></svg>",
)}`;

export const COMPARISON_CATEGORY: PublicGiftCategory = {
	id: 'category-sport',
	presetKey: null,
	customLabel: 'Sport',
	color: '#0369A1',
	sortOrder: 0,
};

/** Available, unreserved gift shared by the GiftCard and GiftListItem stories. */
export const BASE_STORY_GIFT: GiftForVisitor = {
	id: 'gift-1',
	wishlistId: 'wishlist-1',
	name: 'Bezdrátová sluchátka',
	description: null,
	descriptionAppends: [],
	editedAfterShareAt: null,
	links: [{ url: 'https://www.alza.cz/sluchatka' }],
	price: 1490,
	priceMax: null,
	currency: 'CZK',
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
	likeCount: 2,
	reservedCount: 0,
	isFullyReserved: false,
	reserverNames: [],
	myReservationId: null,
	myReservationPurchasedAt: null,
};

// Matched unavailable-treatment pair: identical gift, only reservation state differs.
export const COMPARISON_AVAILABLE: GiftForVisitor = {
	...BASE_STORY_GIFT,
	description: 'Tichá sluchátka na cesty',
	imageUrl: PAINTED_GIFT_IMAGE_URL,
	categoryId: COMPARISON_CATEGORY.id,
	category: COMPARISON_CATEGORY,
	priorityLabel: 'Vysoka',
};

export const COMPARISON_RESERVED_BY_OTHERS: GiftForVisitor = {
	...COMPARISON_AVAILABLE,
	reservedCount: 1,
	isFullyReserved: true,
	reserverNames: ['Babička'],
};

export const COMPARISON_RECEIVED: GiftForVisitor = { ...COMPARISON_AVAILABLE, received: true };
