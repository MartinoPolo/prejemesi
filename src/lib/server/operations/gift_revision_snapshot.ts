import type { gift } from '$lib/server/db/gift.schema.js';
import { jsonChanged } from '$lib/modules/gifts/gift_post_share.js';

/** The gift state a revision records: user-visible fields plus the state undo must restore. */
export type GiftRevisionSource = Pick<
	typeof gift.$inferSelect,
	| 'name'
	| 'description'
	| 'descriptionAppends'
	| 'links'
	| 'price'
	| 'priceMax'
	| 'currency'
	| 'imageUrl'
	| 'imageKey'
	| 'imageMeta'
	| 'quantity'
	| 'priorityLevelId'
	| 'categoryId'
	| 'received'
	| 'deletedAt'
	| 'editedAfterShareAt'
	| 'preEditShareSnapshot'
>;

type GiftRevisionTimestampField = 'deletedAt' | 'editedAfterShareAt';

/** ISO timestamps, so a snapshot survives the jsonb round trip unchanged. */
export type GiftRevisionSnapshot = Omit<GiftRevisionSource, GiftRevisionTimestampField> &
	Record<GiftRevisionTimestampField, string | null>;

function isoTimestamp(value: Date | null): string | null {
	return value instanceof Date ? value.toISOString() : null;
}

export function toGiftRevisionSnapshot(giftRow: GiftRevisionSource): GiftRevisionSnapshot {
	return {
		name: giftRow.name,
		description: giftRow.description,
		descriptionAppends: giftRow.descriptionAppends,
		links: giftRow.links,
		price: giftRow.price,
		priceMax: giftRow.priceMax,
		currency: giftRow.currency,
		imageUrl: giftRow.imageUrl,
		imageKey: giftRow.imageKey,
		imageMeta: giftRow.imageMeta,
		quantity: giftRow.quantity,
		priorityLevelId: giftRow.priorityLevelId,
		categoryId: giftRow.categoryId,
		received: giftRow.received,
		deletedAt: isoTimestamp(giftRow.deletedAt),
		editedAfterShareAt: isoTimestamp(giftRow.editedAfterShareAt),
		preEditShareSnapshot: giftRow.preEditShareSnapshot,
	};
}

/** Structural comparison that ignores jsonb key order and null/undefined differences. */
export function giftRevisionSnapshotsDiffer(
	first: GiftRevisionSnapshot | null,
	second: GiftRevisionSnapshot | null,
): boolean {
	return jsonChanged(first, second);
}
