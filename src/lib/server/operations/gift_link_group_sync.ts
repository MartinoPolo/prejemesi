import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { jsonChanged } from '$lib/modules/gifts/gift_post_share.js';
import { giftCover } from '$lib/modules/gifts/gift_images.js';
import { activeGiftCategoriesColumn } from '$lib/modules/gift-categories/gift_categories_service.js';
import type { MutationOperationContext } from './operation.js';
import { giftColumnsWithImages, replaceGiftGalleries } from './gift_gallery.js';
import { mapCategoriesIntoWishlist } from './gift_category_mapping.js';
import {
	deferReplacedImageCleanup,
	giftRowAfterWrite,
	planPresentationUpdate,
	type GiftRow,
	type GiftUpdateData,
} from './gift_presentation_update.js';
import type { ManagerRole } from './wishlist_management.js';
import { managerEditNotifiesReservers } from './wishlist_kind_rules.js';

/** Fields every linked copy shares; priority, order and likes stay per copy (issue #742). */
const LINKED_GIFT_SYNCED_FIELDS = [
	'name',
	'description',
	'descriptionAppends',
	'links',
	'price',
	'priceMax',
	'currency',
	'quantity',
	'received',
] as const satisfies readonly (keyof GiftRow)[];

export interface LinkedGiftEdit {
	before: GiftRow;
	after: GiftRow;
	/** The editor's role on the edited copy's wishlist, which decides reserver notices. */
	editorRole: ManagerRole;
	/** An undo keeps released uploads, as it does on the edited copy. */
	restoring: boolean;
}

/** The synced field values an edit changed, categories and gallery aside. */
function changedSyncedFields(edit: LinkedGiftEdit): GiftUpdateData {
	return Object.fromEntries(
		LINKED_GIFT_SYNCED_FIELDS.filter((field) =>
			jsonChanged(edit.before[field], edit.after[field]),
		).map((field) => [field, edit.after[field]]),
	);
}

async function editedGiftCategories(transaction: DatabaseTransaction, giftId: string) {
	const [row] = await transaction
		.select({ categories: activeGiftCategoriesColumn() })
		.from(gift)
		.where(eq(gift.id, giftId));
	return row?.categories ?? [];
}

/**
 * Writes the synced fields an edit changed to every other live copy of the edited gift's link
 * group in the same transaction. Categories map into each copy's wishlist like a copy; the gallery's
 * uploads become shared, which reference-aware cleanup keeps alive. Each changed copy gets its own
 * transparency mark on a shared wishlist, revision and reserver notice. The caller holds the group
 * locked (`lockLinkedCopies`) and already enforced the strictest copy's rules on the edit.
 */
export async function propagateToLinkedCopies(
	context: MutationOperationContext,
	edit: LinkedGiftEdit,
): Promise<void> {
	const { transaction, now } = context;
	const linkGroupId = edit.after.linkGroupId;
	if (linkGroupId === null) {
		return;
	}
	const { received, ...syncedEdit } = changedSyncedFields(edit);
	const galleryChanged = jsonChanged(edit.before.images, edit.after.images);
	const categoriesChanged = jsonChanged(edit.before.categoryIds, edit.after.categoryIds);
	if (
		Object.keys(syncedEdit).length === 0 &&
		received === undefined &&
		!galleryChanged &&
		!categoriesChanged
	) {
		return;
	}
	const siblings = await transaction
		.select({ giftRow: giftColumnsWithImages(), wishlistRow: wishlist })
		.from(gift)
		.innerJoin(wishlist, eq(wishlist.id, gift.wishlistId))
		.where(
			and(
				eq(gift.linkGroupId, linkGroupId),
				ne(gift.id, edit.after.id),
				isNull(gift.deletedAt),
			),
		)
		.orderBy(asc(gift.id))
		.for('update', { of: gift });
	const sourceCategories =
		categoriesChanged && siblings.length > 0
			? await editedGiftCategories(transaction, edit.after.id)
			: [];
	const nextCover = giftCover(edit.after.images);
	for (const { giftRow, wishlistRow } of siblings) {
		const editData: GiftUpdateData = {
			...syncedEdit,
			...(galleryChanged
				? {
						imageUrl: nextCover.imageUrl,
						imageKey: nextCover.imageKey,
						imageMeta: nextCover.imageMeta,
					}
				: {}),
			...(categoriesChanged
				? {
						categoryIds: await mapCategoriesIntoWishlist(
							transaction,
							giftRow.wishlistId,
							sourceCategories,
						),
					}
				: {}),
		};
		const nextImages =
			galleryChanged && jsonChanged(edit.after.images, giftRow.images)
				? edit.after.images
				: undefined;
		// Received is state, not a post-share edit, exactly as on the edited copy.
		const plan = planPresentationUpdate({
			giftRow,
			updateData: editData,
			nextImages,
			now,
			wishlistRow,
		});
		const receivedChanged = received !== undefined && received !== giftRow.received;
		if (!plan.didChange && !receivedChanged) {
			continue;
		}
		const updateData: GiftUpdateData = {
			...plan.updateData,
			...(receivedChanged ? { received } : {}),
		};
		if (nextImages !== undefined) {
			await replaceGiftGalleries(transaction, new Map([[giftRow.id, nextImages]]));
		}
		await transaction
			.update(gift)
			.set({ ...updateData, updatedAt: now })
			.where(eq(gift.id, giftRow.id));
		const updated = giftRowAfterWrite(giftRow, updateData, nextImages);
		context.recordGiftRevisions([
			{ giftId: giftRow.id, wishlistId: giftRow.wishlistId, before: giftRow, after: updated },
		]);
		if (!edit.restoring && nextImages !== undefined) {
			deferReplacedImageCleanup(context, giftRow.images, nextImages);
		}
		if (
			plan.didChange &&
			managerEditNotifiesReservers({ role: edit.editorRole, wishlistRow })
		) {
			context.noteReservedGiftEdits([
				{
					giftId: giftRow.id,
					giftName: updated.name,
					wishlistId: giftRow.wishlistId,
					wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
				},
			]);
		}
	}
}
