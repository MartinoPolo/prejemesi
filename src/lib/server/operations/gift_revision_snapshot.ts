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
	| 'categoryIds'
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
		categoryIds: giftRow.categoryIds,
		received: giftRow.received,
		deletedAt: isoTimestamp(giftRow.deletedAt),
		editedAfterShareAt: isoTimestamp(giftRow.editedAfterShareAt),
		preEditShareSnapshot: giftRow.preEditShareSnapshot,
	};
}

/**
 * A stored snapshot in the current shape. Snapshots recorded before gifts carried several
 * categories hold only the single `categoryId`, which becomes the one-item list.
 */
export function currentGiftRevisionSnapshot(snapshot: GiftRevisionSnapshot): GiftRevisionSnapshot {
	const { categoryId, ...current } = snapshot as GiftRevisionSnapshot & {
		categoryId?: string | null;
	};
	if (Array.isArray(current.categoryIds)) {
		return current;
	}
	return { ...current, categoryIds: categoryId == null ? [] : [categoryId] };
}

/** Structural comparison that ignores jsonb key order and null/undefined differences. */
export function giftRevisionSnapshotsDiffer(
	first: GiftRevisionSnapshot | null,
	second: GiftRevisionSnapshot | null,
): boolean {
	return jsonChanged(
		first === null ? null : currentGiftRevisionSnapshot(first),
		second === null ? null : currentGiftRevisionSnapshot(second),
	);
}
