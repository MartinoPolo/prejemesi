import type { gift } from '$lib/server/db/gift.schema.js';
import type { GiftWithImages } from '$lib/modules/gifts/types.js';
import {
	computePostShareEditTransparency,
	jsonChanged,
	toPreShareGiftSnapshot,
} from '$lib/modules/gifts/gift_post_share.js';
import { isOwnerSharedGiftDeleteGraceOpen } from '$lib/modules/gifts/gift_deletion_rules.js';
import { releasedImageKeys, type GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { MutationOperationContext } from './operation.js';
import { deleteUnreferencedGiftImagesBestEffort } from './gift_gallery.js';
import type { WishlistRow } from './wishlist_management.js';

/** A locked gift with its ordered gallery; read it with `giftColumnsWithImages()`. */
export type GiftRow = GiftWithImages;
export type GiftUpdateData = Partial<typeof gift.$inferInsert>;

/**
 * Root of the "Upraveno po sdílení" transparency tracking (issue #124): given a changed gift edit,
 * decides the next `editedAfterShareAt` / `preEditShareSnapshot` values and writes them onto
 * `updateData`, so a net-zero revert inside grace behaves identically on every write path.
 */
export function applyPostShareEditTransparency(params: {
	giftRow: GiftRow;
	updateData: GiftUpdateData;
	nextImages?: GiftImage[];
	now: Date;
	wishlistRow: WishlistRow;
}): void {
	const { giftRow, updateData, nextImages, now, wishlistRow } = params;
	const graceOpen = isOwnerSharedGiftDeleteGraceOpen(
		{ wishlistSharedAt: wishlistRow.sharedAt, giftCreatedAt: giftRow.createdAt },
		now,
	);
	const outcome = computePostShareEditTransparency({
		existingSnapshot: giftRow.preEditShareSnapshot,
		graceOpen,
		beforeEdit: toPreShareGiftSnapshot(giftRow),
		afterEdit: toPreShareGiftSnapshot(giftRowAfterWrite(giftRow, updateData, nextImages)),
		now,
	});
	updateData.editedAfterShareAt = outcome.editedAfterShareAt;
	updateData.preEditShareSnapshot = outcome.preEditShareSnapshot;
}

/**
 * The gift row as an edit leaves it, gallery included, for revisions and transparency.
 * `nextImages` is the complete next gallery, or undefined when the edit keeps the images.
 */
export function giftRowAfterWrite(
	giftRow: GiftRow,
	updateData: GiftUpdateData,
	nextImages: GiftImage[] | undefined,
): GiftRow {
	return { ...giftRow, ...updateData, images: nextImages ?? giftRow.images } as GiftRow;
}

export function updateDataChangesGift(
	giftRow: GiftRow,
	updateData: GiftUpdateData,
	nextImages?: GiftImage[],
): boolean {
	return (
		Object.entries(updateData).some(([key, value]) =>
			jsonChanged(value, giftRow[key as keyof GiftRow]),
		) ||
		(nextImages !== undefined && jsonChanged(nextImages, giftRow.images))
	);
}

/**
 * Plans a presentation edit (priority, category, image) shared by bulk and grouped-reorder
 * writes: only a value that actually changes counts, and on shared wishlists it follows the same
 * "Upraveno po sdílení" transparency rule as the gift editor.
 */
export function planPresentationUpdate(params: {
	giftRow: GiftRow;
	updateData: GiftUpdateData;
	nextImages?: GiftImage[];
	now: Date;
	wishlistRow: WishlistRow;
}): {
	giftRow: GiftRow;
	updateData: GiftUpdateData;
	nextImages?: GiftImage[];
	didChange: boolean;
} {
	const { giftRow, updateData, nextImages, now, wishlistRow } = params;
	const didChange = updateDataChangesGift(giftRow, updateData, nextImages);
	if (didChange && wishlistRow.sharedAt !== null) {
		applyPostShareEditTransparency({ giftRow, updateData, nextImages, now, wishlistRow });
	}
	return { giftRow, updateData, nextImages, didChange };
}

/**
 * Storage cleanup (issue #107): replacing, removing or dropping an uploaded image from the gallery
 * leaves no unreferenced R2 object behind. A key that only moved to another position stays.
 */
export function deferReplacedImageCleanup(
	context: MutationOperationContext,
	previousImages: readonly GiftImage[],
	nextImages: readonly GiftImage[],
): void {
	const releasedKeys = releasedImageKeys(previousImages, nextImages);
	if (releasedKeys.length > 0) {
		context.deferEffect(() => deleteUnreferencedGiftImagesBestEffort(releasedKeys));
	}
}
