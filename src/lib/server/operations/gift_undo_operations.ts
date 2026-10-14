import * as v from 'valibot';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { giftRevision } from '$lib/server/db/gift_revision.schema.js';
import { SERVER_ERROR, encodeServerError } from '$lib/modules/errors/server_error_codes.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import {
	GIFT_CURRENCIES,
	type GiftCurrency,
	type UpdateGiftInput,
} from '$lib/modules/gifts/types.js';
import { jsonChanged } from '$lib/modules/gifts/gift_post_share.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import {
	lockWishlistsInIdOrder,
	requireWishlistManagement,
	type ManagedWishlist,
} from './wishlist_management.js';
import { applyGiftUpdate, type GiftRow, type RestoredGiftState } from './gift_update.js';
import { softDeleteGift } from './gift_deletion.js';
import {
	giftRevisionSnapshotsDiffer,
	toGiftRevisionSnapshot,
	type GiftRevisionSnapshot,
} from './gift_revision_snapshot.js';

type GiftRevisionRow = typeof giftRevision.$inferSelect;

interface GiftUndoResult {
	restoredGiftIds: string[];
	wishlistShortIds: string[];
}

function supportedCurrency(currency: string | null): GiftCurrency | null {
	return Object.values(GIFT_CURRENCIES).find((supported) => supported === currency) ?? null;
}

/**
 * Owning mutations delete the upload of a replaced, removed or deleted image after commit, so a
 * restored upload key that the undone change replaced or deleted may point at a missing object.
 * Undo never deletes storage, except that undoing a creation deletes the gift through the ordinary
 * delete path, which removes its upload. A restored deleted gift drops the missing upload like
 * removing it in the editor; an undone image change keeps the current image so it is not orphaned.
 */
function planImageRestore(
	before: GiftRevisionSnapshot,
	after: GiftRevisionSnapshot,
	undoesDeletion: boolean,
): Pick<UpdateGiftInput, 'imageUrl' | 'imageKey' | 'imageMeta'> {
	const restoresRemovedUpload =
		before.imageKey !== null && (before.imageKey !== after.imageKey || undoesDeletion);
	if (restoresRemovedUpload) {
		return undoesDeletion ? { imageUrl: null, imageKey: null, imageMeta: null } : {};
	}
	const changed = (key: 'imageUrl' | 'imageKey' | 'imageMeta') =>
		jsonChanged(before[key], after[key]);
	return {
		...(changed('imageUrl') ? { imageUrl: before.imageUrl } : {}),
		...(changed('imageKey') ? { imageKey: before.imageKey } : {}),
		...(changed('imageMeta') ? { imageMeta: before.imageMeta } : {}),
	};
}

/** Builds the edit and restored state that bring a gift from `after` back to `before`. */
function planRestore(
	giftId: string,
	before: GiftRevisionSnapshot,
	after: GiftRevisionSnapshot,
): { input: UpdateGiftInput; restoring: RestoredGiftState } {
	const changed = (key: keyof GiftRevisionSnapshot) => jsonChanged(before[key], after[key]);
	const undoesDeletion = before.deletedAt === null && after.deletedAt !== null;
	const imageInput = planImageRestore(before, after, undoesDeletion);
	const input: UpdateGiftInput = {
		id: giftId,
		...(changed('name') ? { name: before.name } : {}),
		...(changed('description') ? { description: before.description } : {}),
		...(changed('links') ? { links: before.links } : {}),
		...(changed('price') ? { price: before.price } : {}),
		...(changed('priceMax') ? { priceMax: before.priceMax } : {}),
		...(changed('currency') ? { currency: supportedCurrency(before.currency) } : {}),
		...imageInput,
		...(changed('quantity') ? { quantity: before.quantity } : {}),
		...(changed('priorityLevelId') ? { priorityLevelId: before.priorityLevelId } : {}),
		...(changed('categoryId') ? { categoryId: before.categoryId } : {}),
	};
	const restoring: RestoredGiftState = {
		...(changed('descriptionAppends') ? { descriptionAppends: before.descriptionAppends } : {}),
		...(changed('received') ? { received: before.received } : {}),
		...(undoesDeletion ? { deletedAt: null } : {}),
	};
	return { input, restoring };
}

/** The id of each gift's latest revision, read from the latest-revision index alone. */
async function findLatestRevisionIds(
	transaction: DatabaseTransaction,
	giftIds: readonly string[],
): Promise<Map<string, string>> {
	const latestRevisions = await transaction
		.selectDistinctOn([giftRevision.giftId], {
			id: giftRevision.id,
			giftId: giftRevision.giftId,
		})
		.from(giftRevision)
		.where(inArray(giftRevision.giftId, [...giftIds]))
		.orderBy(asc(giftRevision.giftId), desc(giftRevision.createdAt), desc(giftRevision.id));
	return new Map(latestRevisions.map((revision) => [revision.giftId, revision.id]));
}

/**
 * Restores the gifts touched by `revisions` to their `before` state as one ordinary mutation by
 * the undoing actor, so manager access and post-share rules apply exactly as to a manual edit.
 * Refuses with 409 (listing the gift ids) when any gift changed after its revision.
 */
async function undoRevisions(
	context: MutationOperationContext,
	revisions: readonly GiftRevisionRow[],
): Promise<GiftUndoResult> {
	const { transaction } = context;
	const giftIds = revisions.map((revision) => revision.giftId);
	if (new Set(giftIds).size !== giftIds.length) {
		error(
			409,
			encodeServerError(SERVER_ERROR.GIFT_REVISION_CONFLICT, { giftIds: giftIds.join(',') }),
		);
	}

	const wishlistIds = [...new Set(revisions.map((revision) => revision.wishlistId))];
	await lockWishlistsInIdOrder(transaction, wishlistIds);
	const managedWishlists = new Map<string, ManagedWishlist>();
	for (const wishlistId of wishlistIds) {
		const managedWishlist = await requireWishlistManagement(
			transaction,
			context.actor.userId,
			wishlistId,
			{ lock: true },
		);
		assertWishlistMutable(managedWishlist.wishlistRow);
		managedWishlists.set(wishlistId, managedWishlist);
	}

	const giftRows = await transaction
		.select()
		.from(gift)
		.where(inArray(gift.id, giftIds))
		.orderBy(asc(gift.id))
		.for('update');
	const giftRowsById = new Map(giftRows.map((row) => [row.id, row]));
	const latestRevisionIds = await findLatestRevisionIds(transaction, giftIds);

	const conflictingGiftIds = revisions
		.filter((revision) => {
			const giftRow = giftRowsById.get(revision.giftId);
			return (
				giftRow === undefined ||
				giftRow.wishlistId !== revision.wishlistId ||
				latestRevisionIds.get(revision.giftId) !== revision.id ||
				giftRevisionSnapshotsDiffer(toGiftRevisionSnapshot(giftRow), revision.after)
			);
		})
		.map((revision) => revision.giftId);
	if (conflictingGiftIds.length > 0) {
		error(
			409,
			encodeServerError(SERVER_ERROR.GIFT_REVISION_CONFLICT, {
				giftIds: conflictingGiftIds.join(','),
			}),
		);
	}

	for (const revision of revisions) {
		const giftRow: GiftRow | undefined = giftRowsById.get(revision.giftId);
		const managedWishlist = managedWishlists.get(revision.wishlistId);
		if (giftRow === undefined || managedWishlist === undefined) {
			throw new Error(`Undo lost the locked state of gift ${revision.giftId}`);
		}
		if (revision.before === null) {
			// Undoing a creation deletes the gift under the ordinary deletion rules, upload included.
			await softDeleteGift(context, giftRow, managedWishlist);
			continue;
		}
		const { input, restoring } = planRestore(giftRow.id, revision.before, revision.after);
		await applyGiftUpdate(context, { giftRow, managedWishlist, input, restoring });
	}

	return {
		restoredGiftIds: giftIds,
		wishlistShortIds: [...managedWishlists.values()].map(
			(managedWishlist) => managedWishlist.wishlistRow.shortId,
		),
	};
}

/** Undoes every gift change of one batch atomically. */
export const undoGiftRevisionBatchOperation = defineOperation({
	name: 'undoGiftRevisionBatch',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ batchId: v.string() }),
	async run(context, { batchId }) {
		const revisions = await context.transaction
			.select()
			.from(giftRevision)
			.where(eq(giftRevision.batchId, batchId))
			.orderBy(asc(giftRevision.giftId));
		if (revisions.length === 0) {
			error(404, SERVER_ERROR.GIFT_REVISION_NOT_FOUND);
		}
		return undoRevisions(context, revisions);
	},
});

/** Undoes the latest recorded change of one gift. */
export const undoGiftRevisionOperation = defineOperation({
	name: 'undoGiftRevision',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ giftId: v.string() }),
	async run(context, { giftId }) {
		const latestRevisionId = (await findLatestRevisionIds(context.transaction, [giftId])).get(
			giftId,
		);
		const [latestRevision] =
			latestRevisionId === undefined
				? []
				: await context.transaction
						.select()
						.from(giftRevision)
						.where(eq(giftRevision.id, latestRevisionId));
		if (latestRevision === undefined) {
			error(404, SERVER_ERROR.GIFT_REVISION_NOT_FOUND);
		}
		return undoRevisions(context, [latestRevision]);
	},
});
