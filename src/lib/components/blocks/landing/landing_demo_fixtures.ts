/**
 * Hand-written fixture data for the landing page's interactive demo (issue #218).
 *
 * Nothing here touches the database, a remote function, or the session: the demo is a
 * pure client-side illustration of the product's core invariant (gifters see reservation
 * state, the recipient never does). Copy is resolved through Paraglide at call time, so
 * every builder below is a function — calling it at module scope would freeze the fixtures
 * to whichever locale happened to load first.
 */
import { asset } from '$app/paths';
import { IMAGE_FIT_MODES } from '$lib/modules/images/fit_modes.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
import type { GiftForRecipient, GiftForVisitor, GiftLink } from '$lib/modules/gifts/types.js';
import * as m from '$lib/paraglide/messages.js';

const LANDING_DEMO_WISHLIST_ID = 'landing-demo-wishlist';

/** Fixed date so server and client render the identical fixture (no hydration mismatch). */
const LANDING_DEMO_CREATED_AT = new Date('2026-01-01T00:00:00Z');

/**
 * The illustrations are square and full-bleed, so an explicit centered cover crop fills
 * both consumer aspects (4:3 gift card, 1:1 list thumb) without letterbox bars.
 */
const LANDING_DEMO_IMAGE_META: ImageMetadata = {
	fitMode: IMAGE_FIT_MODES.coverCrop,
	cropRect: null,
	focal: { x: 50, y: 50 },
	zoom: 1,
	bgColor: null,
};

interface LandingDemoGiftSeed {
	id: string;
	name: () => string;
	description: () => string;
	price: number;
	imageUrl: string;
	links: readonly GiftLink[];
	likeCount: number;
}

/** Petra's birthday wishlist — six gifts, warm and ordinary on purpose. */
const LANDING_DEMO_GIFT_SEEDS = [
	{
		id: 'teapot',
		name: () => m.landing_demo_gift_teapot_name(),
		description: () => m.landing_demo_gift_teapot_description(),
		price: 890,
		imageUrl: asset('/demo/teapot.svg'),
		links: [{ url: 'https://www.alza.cz/' }],
		likeCount: 3,
	},
	{
		id: 'headphones',
		name: () => m.landing_demo_gift_headphones_name(),
		description: () => m.landing_demo_gift_headphones_description(),
		price: 2490,
		imageUrl: asset('/demo/headphones.svg'),
		links: [{ url: 'https://www.alza.cz/' }],
		likeCount: 5,
	},
	{
		id: 'plant-book',
		name: () => m.landing_demo_gift_book_name(),
		description: () => m.landing_demo_gift_book_description(),
		price: 399,
		imageUrl: asset('/demo/plant-book.svg'),
		links: [{ url: 'https://www.knihydobrovsky.cz/' }],
		likeCount: 2,
	},
	{
		id: 'candle',
		name: () => m.landing_demo_gift_candle_name(),
		description: () => m.landing_demo_gift_candle_description(),
		price: 650,
		imageUrl: asset('/demo/candle.svg'),
		links: [{ url: 'https://www.notino.cz/' }],
		likeCount: 1,
	},
	{
		id: 'backpack',
		name: () => m.landing_demo_gift_backpack_name(),
		description: () => m.landing_demo_gift_backpack_description(),
		price: 1790,
		imageUrl: asset('/demo/backpack.svg'),
		links: [],
		likeCount: 0,
	},
	{
		id: 'watercolours',
		name: () => m.landing_demo_gift_watercolours_name(),
		description: () => m.landing_demo_gift_watercolours_description(),
		price: 1290,
		imageUrl: asset('/demo/watercolours.svg'),
		links: [],
		likeCount: 4,
	},
] as const satisfies readonly LandingDemoGiftSeed[];

function buildDemoGift(seed: LandingDemoGiftSeed, sortOrder: number): GiftForVisitor {
	return {
		id: seed.id,
		wishlistId: LANDING_DEMO_WISHLIST_ID,
		name: seed.name(),
		description: seed.description(),
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [...seed.links],
		price: seed.price,
		priceMax: null,
		currency: 'CZK',
		imageUrl: seed.imageUrl,
		imageKey: null,
		imageMeta: LANDING_DEMO_IMAGE_META,
		quantity: 1,
		sortOrder,
		received: false,
		createdAt: LANDING_DEMO_CREATED_AT,
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: seed.likeCount,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};
}

/** The unreserved baseline every demo view derives from. */
export function createLandingDemoGifts(): GiftForVisitor[] {
	return LANDING_DEMO_GIFT_SEEDS.map(buildDemoGift);
}

/**
 * The gift shown twice in the mobile hook. Its own id keeps it addressable
 * independently of the interactive list below, which repeats the same wish.
 */
export function createLandingDemoPairGift(): GiftForVisitor {
	return { ...buildDemoGift(LANDING_DEMO_GIFT_SEEDS[0], 0), id: 'pair-gift' };
}

/**
 * The same gift once it is claimed — what a fellow gifter sees. `reservedByViewer` decides
 * whether the demo visitor holds the reservation (and can cancel it) or someone else does.
 */
export function reserveDemoGift(gift: GiftForVisitor, reservedByViewer: boolean): GiftForVisitor {
	return {
		...gift,
		reservedCount: 1,
		isFullyReserved: true,
		// Reserver names reach moderators only; a plain visitor sees the anonymous state.
		reserverNames: [],
		myReservationId: reservedByViewer ? `${gift.id}-reservation` : null,
	};
}

/**
 * Strips every reservation-derived field, exactly as the server does before a recipient
 * ever receives a gift row. The demo drops them on the client too, so the recipient pane
 * cannot render the surprise even by accident.
 */
export function toRecipientView(gift: GiftForVisitor): GiftForRecipient {
	return {
		id: gift.id,
		wishlistId: gift.wishlistId,
		name: gift.name,
		description: gift.description,
		descriptionAppends: gift.descriptionAppends,
		editedAfterShareAt: gift.editedAfterShareAt,
		links: gift.links,
		price: gift.price,
		priceMax: gift.priceMax,
		currency: gift.currency,
		imageUrl: gift.imageUrl,
		imageKey: gift.imageKey,
		imageMeta: gift.imageMeta,
		quantity: gift.quantity,
		sortOrder: gift.sortOrder,
		received: gift.received,
		createdAt: gift.createdAt,
		priorityLevelId: gift.priorityLevelId,
		priorityLabel: gift.priorityLabel,
		prioritySortOrder: gift.prioritySortOrder,
	};
}
