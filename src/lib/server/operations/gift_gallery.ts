import { getTableColumns, inArray, sql } from 'drizzle-orm';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { gift, giftImage } from '$lib/server/db/gift.schema.js';
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
