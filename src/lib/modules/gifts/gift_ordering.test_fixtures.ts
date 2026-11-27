import type { GiftForRecipient, GiftForVisitor } from './types.js';
import { projectGiftForRecipient, type GiftSection } from './gift_ordering.js';

let idCounter = 0;

export function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	idCounter += 1;
	return {
		id: `gift-${idCounter}`,
		wishlistId: 'wishlist-1',
		name: `Gift ${idCounter}`,
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
		sortOrder: idCounter,
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
		myReservationQuantity: 0,
		myReservationOnLinkedCopy: false,
		reservedOnLinkedCopiesCount: 0,
		linkedCopies: [],
		linkGroupKind: null,
		sharedWith: [],
		...overrides,
	};
}

/** The recipient projection of a gift: the server sends it without reservation or like data. */
export function recipientShapedGift(gift: GiftForVisitor = makeGift()): GiftForRecipient {
	return projectGiftForRecipient(gift);
}

/** All gift ids across every section, in flattened render order. */
export function flatIds(sections: GiftSection[]): string[] {
	return sections.flatMap((section) => section.gifts.map((gift) => gift.id));
}

export const LOCALE = 'cs';
