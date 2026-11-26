import { and, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import { getDb, type DatabaseTransaction } from '$lib/server/db/index.js';
import { gift, giftImage } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';

/**
 * A gift's ordered gallery as a correlated subquery, so a gift read carries its images in the same
 * statement instead of one query per gift.
 */
export function giftImagesColumn() {
	// Single-table selects render columns unqualified, where a bare gift id would resolve to the
	// gallery row's own id, so the correlation names the outer gift table explicitly.
	return sql<GiftImage[]>`(
		SELECT coalesce(
			json_agg(
				json_build_object(
					'imageUrl', gallery_image.image_url,
					'imageKey', gallery_image.image_key,
					'imageMeta', gallery_image.image_meta
				)
				ORDER BY gallery_image.position
			),
			'[]'::json
		)
		FROM ${giftImage} AS gallery_image
		WHERE gallery_image.gift_id = "gift"."id"
	)`;
}

/** Every gift column plus the ordered gallery. */
export function giftColumnsWithImages() {
	return { ...getTableColumns(gift), images: giftImagesColumn() };
}

/** Replaces each listed gift's whole gallery; an empty list removes every image of that gift. */
export async function replaceGiftGalleries(
	transaction: Pick<DatabaseTransaction, 'delete' | 'insert'>,
	galleries: ReadonlyMap<string, readonly GiftImage[]>,
): Promise<void> {
	if (galleries.size === 0) {
		return;
	}
	await transaction.delete(giftImage).where(inArray(giftImage.giftId, [...galleries.keys()]));
	const imageRows = [...galleries].flatMap(([giftId, images]) =>
		images.map((image, position) => ({
			giftId,
			position,
			imageUrl: image.imageUrl,
			imageKey: image.imageKey,
			imageMeta: image.imageMeta,
		})),
	);
	if (imageRows.length > 0) {
		await transaction.insert(giftImage).values(imageRows);
	}
}

/**
 * Deletes the uploads a committed change released, except those a live gift on a live wishlist
 * still shows: linked copies share the uploads an edit synced to them (issue #742).
 */
export async function deleteUnreferencedGiftImagesBestEffort(
	releasedKeys: readonly string[],
): Promise<void> {
	if (releasedKeys.length === 0) {
		return;
	}
	const referencedRows = await getDb()
		.selectDistinct({ imageKey: giftImage.imageKey })
		.from(giftImage)
		.innerJoin(gift, eq(gift.id, giftImage.giftId))
		.innerJoin(wishlist, eq(wishlist.id, gift.wishlistId))
		.where(
			and(
				inArray(giftImage.imageKey, [...releasedKeys]),
				isNull(gift.deletedAt),
				isNull(wishlist.deletedAt),
			),
		);
	const referencedKeys = new Set(referencedRows.map((row) => row.imageKey));
	await deleteObjectsBestEffort(releasedKeys.filter((key) => !referencedKeys.has(key)));
}
