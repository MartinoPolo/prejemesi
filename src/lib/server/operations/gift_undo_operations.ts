import * as v from 'valibot';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
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
import { releasedImageKeys } from '$lib/modules/gifts/gift_images.js';
import { giftColumnsWithImages } from './gift_gallery.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import {
	findWishlistManagement,
	lockWishlistsInIdOrder,
	requireWishlistManagement,
	type ManagedWishlist,
} from './wishlist_management.js';
import { applyGiftUpdate, type RestoredGiftState } from './gift_update.js';
import type { GiftRow } from './gift_presentation_update.js';
import { softDeleteGift } from './gift_deletion.js';
import { lockLinkedCopies } from './gift_link_group.js';
import {
	currentGiftRevisionSnapshot,
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
 * Owning mutations delete the uploads a change drops from the gallery, or a deleted gift's uploads,
 * after commit, so a restored upload key that the undone change dropped or deleted may point at a
 * missing object. Undo never deletes storage, except that undoing a creation deletes the gift
 * through the ordinary delete path, which removes its uploads. A restored deleted gift drops the
 * missing uploads like removing them in the editor; an undone change that dropped an upload keeps
 * the current gallery so no image is orphaned.
 */
function planImageRestore(
	before: GiftRevisionSnapshot,
	after: GiftRevisionSnapshot,
	undoesDeletion: boolean,
): Pick<UpdateGiftInput, 'images'> {
	const restoredImages = undoesDeletion
		? before.images.filter((image) => image.imageKey === null)
		: before.images;
	if (!undoesDeletion && releasedImageKeys(before.images, after.images).length > 0) {
		return {};
	}
	return jsonChanged(restoredImages, after.images) ? { images: restoredImages } : {};
}

/** Fields an undo restores, through the edit rules or verbatim as state. */
const RESTORED_FIELDS = [
	'name',
	'description',
	'links',
	'price',
	'priceMax',
	'currency',
	'quantity',
	'priorityLevelId',
	'categoryIds',
	'descriptionAppends',
	'received',
] as const satisfies readonly (keyof GiftRevisionSnapshot)[];

interface RestorePlan {
	input: UpdateGiftInput;
	restoring: RestoredGiftState;
	/** The gift already holds everything the undo would restore. */
	nothingToRestore: boolean;
}

/** Builds the edit and restored state that bring a gift from `after` back to `before`. */
function planRestore(
	giftId: string,
	before: GiftRevisionSnapshot,
	after: GiftRevisionSnapshot,
): RestorePlan {
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
		...(changed('categoryIds') ? { categoryIds: before.categoryIds } : {}),
	};
	const restoring: RestoredGiftState = {
		...(changed('descriptionAppends') ? { descriptionAppends: before.descriptionAppends } : {}),
		...(changed('received') ? { received: before.received } : {}),
		...(undoesDeletion ? { deletedAt: null } : {}),
	};
	const nothingToRestore =
		!undoesDeletion && imageInput.images === undefined && !RESTORED_FIELDS.some(changed);
	return { input, restoring, nothingToRestore };
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
 * The actor's management of each live wishlist, without failing for one they do not manage. The
 * caller holds the wishlists FOR UPDATE, which every role change waits for.
 */
async function resolveManagedWishlists(
	transaction: DatabaseTransaction,
	actorUserId: string,
	wishlistIds: readonly string[],
): Promise<Map<string, ManagedWishlist>> {
	const managedWishlists = new Map<string, ManagedWishlist>();
	for (const wishlistId of wishlistIds) {
		const managedWishlist = await findWishlistManagement(transaction, actorUserId, wishlistId, {
			lock: false,
		});
		if (managedWishlist !== null) {
			managedWishlists.set(wishlistId, managedWishlist);
		}
	}
	return managedWishlists;
}

/**
 * The actor's mutable management of a wishlist, failing exactly as a manual edit there would:
 * 404 for a missing wishlist, 403 for one the actor does not manage.
 */
async function requireUndoManagement(
	context: MutationOperationContext,
	managedWishlists: ReadonlyMap<string, ManagedWishlist>,
	wishlistId: string,
): Promise<ManagedWishlist> {
	const managedWishlist =
		managedWishlists.get(wishlistId) ??
		(await requireWishlistManagement(context.transaction, context.actor.userId, wishlistId, {
			lock: true,
		}));
	assertWishlistMutable(managedWishlist.wishlistRow);
	return managedWishlist;
}

/**
 * Restores the gifts touched by `revisions` to their `before` state as one ordinary mutation by
 * the undoing actor, so manager access and post-share rules apply exactly as to a manual edit.
 * Refuses with 409 (listing the gift ids) when any gift changed after its revision.
 *
 * A linked edit revised every copy it synced. Restoring one copy syncs the others back, so a copy
 * left with nothing to restore needs neither a write nor the actor's management of its wishlist:
 * a správce of one list can undo their edit although it reached the recipient's other lists.
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
	await lockLinkedCopies(transaction, giftIds, {
		wishlistIds,
		heldWishlistLocks: context.heldWishlistLocks,
	});
	// The linked pass already holds these when any gift is linked; unlinked gifts need them here.
	await lockWishlistsInIdOrder(transaction, wishlistIds);
	const managedWishlists = await resolveManagedWishlists(
		transaction,
		context.actor.userId,
		wishlistIds,
	);

	const giftRows = await transaction
		.select(giftColumnsWithImages())
		.from(gift)
		.where(inArray(gift.id, giftIds))
		.orderBy(asc(gift.id))
		.for('update');
	const giftRowsById = new Map(giftRows.map((row) => [row.id, row]));
	// Only a linked copy's revision may turn out to need nothing; every other one needs management.
	for (const revision of revisions) {
		if (giftRowsById.get(revision.giftId)?.linkGroupId == null) {
			await requireUndoManagement(context, managedWishlists, revision.wishlistId);
		}
	}
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

	const restoredWishlistShortIds = new Set<string>();
	for (const revision of managedWishlistsFirst(revisions, managedWishlists)) {
		const lockedGiftRow: GiftRow | undefined = giftRowsById.get(revision.giftId);
		if (lockedGiftRow === undefined) {
			throw new Error(`Undo lost the locked state of gift ${revision.giftId}`);
		}
		const restoredShortId = await restoreRevision(
			context,
			revision,
			lockedGiftRow,
			managedWishlists,
		);
		if (restoredShortId !== null) {
			restoredWishlistShortIds.add(restoredShortId);
		}
	}

	return { restoredGiftIds: giftIds, wishlistShortIds: [...restoredWishlistShortIds] };
}

/**
 * Linked copies on wishlists the actor manages go first, so their restores sync the other copies
 * back before those come up.
 */
function managedWishlistsFirst(
	revisions: readonly GiftRevisionRow[],
	managedWishlists: ReadonlyMap<string, ManagedWishlist>,
): GiftRevisionRow[] {
	return [
		...revisions.filter((revision) => managedWishlists.has(revision.wishlistId)),
		...revisions.filter((revision) => !managedWishlists.has(revision.wishlistId)),
	];
}

/**
 * Restores one revision's gift and returns the short id of the wishlist it wrote. Null for a
 * linked copy a restore of an earlier copy already synced back: it needs neither a write nor the
 * actor's management of its wishlist.
 */
async function restoreRevision(
	context: MutationOperationContext,
	revision: GiftRevisionRow,
	lockedGiftRow: GiftRow,
	managedWishlists: ReadonlyMap<string, ManagedWishlist>,
): Promise<string | null> {
	if (revision.before === null) {
		// Undoing a creation deletes the gift under the ordinary deletion rules, upload included.
		const managedWishlist = await requireUndoManagement(
			context,
			managedWishlists,
			revision.wishlistId,
		);
		await softDeleteGift(context, lockedGiftRow, managedWishlist);
		return managedWishlist.wishlistRow.shortId;
	}
	const isLinked = lockedGiftRow.linkGroupId !== null;
	const giftRow = isLinked
		? await currentGiftRow(context.transaction, lockedGiftRow.id)
		: lockedGiftRow;
	const { input, restoring, nothingToRestore } = planRestore(
		giftRow.id,
		currentGiftRevisionSnapshot(revision.before),
		toGiftRevisionSnapshot(giftRow),
	);
	if (isLinked && nothingToRestore) {
		return null;
	}
	const managedWishlist = await requireUndoManagement(
		context,
		managedWishlists,
		revision.wishlistId,
	);
	await applyGiftUpdate(context, { giftRow, managedWishlist, input, restoring });
	return managedWishlist.wishlistRow.shortId;
}

async function currentGiftRow(transaction: DatabaseTransaction, giftId: string): Promise<GiftRow> {
	const [giftRow] = await transaction
		.select(giftColumnsWithImages())
		.from(gift)
		.where(eq(gift.id, giftId));
	if (giftRow === undefined) {
		throw new Error(`Undo lost the locked state of gift ${giftId}`);
	}
	return giftRow;
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

/**
 * Puts back the sort order a reorder replaced, for undoing a proposal batch. Refuses with 409
 * (listing the gift ids) when any of the gifts moved or left the wishlist since the reorder.
 */
export const restoreGiftOrderOperation = defineOperation({
	name: 'restoreGiftOrder',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: v.strictObject({
		wishlistId: v.string(),
		gifts: v.pipe(
			v.array(
				v.strictObject({
					giftId: v.string(),
					previousSortOrder: v.pipe(v.number(), v.integer()),
					appliedSortOrder: v.pipe(v.number(), v.integer()),
				}),
			),
			v.minLength(1),
		),
	}),
	async run(context, { wishlistId, gifts }) {
		const { transaction, now } = context;
		const { wishlistRow } = await requireWishlistManagement(
			transaction,
			context.actor.userId,
			wishlistId,
			{ lock: true },
		);
		assertWishlistMutable(wishlistRow);
		const giftIds = gifts.map((entry) => entry.giftId);
		const giftRows = await transaction
			.select({ id: gift.id, sortOrder: gift.sortOrder })
			.from(gift)
			.where(and(inArray(gift.id, giftIds), eq(gift.wishlistId, wishlistId)))
			.orderBy(asc(gift.id))
			.for('update');
		const sortOrders = new Map(giftRows.map((row) => [row.id, row.sortOrder]));
		const movedGiftIds = gifts
			.filter((entry) => sortOrders.get(entry.giftId) !== entry.appliedSortOrder)
			.map((entry) => entry.giftId);
		if (movedGiftIds.length > 0) {
			error(
				409,
				encodeServerError(SERVER_ERROR.GIFT_REVISION_CONFLICT, {
					giftIds: movedGiftIds.join(','),
				}),
			);
		}
		const sortOrderCase = sql.join(
			gifts.map(
				(entry) =>
					sql`WHEN ${gift.id} = ${entry.giftId} THEN ${entry.previousSortOrder}::integer`,
			),
			sql` `,
		);
		await transaction
			.update(gift)
			.set({ sortOrder: sql<number>`CASE ${sortOrderCase} END`, updatedAt: now })
			.where(and(inArray(gift.id, giftIds), eq(gift.wishlistId, wishlistId)));
		return { wishlistShortId: wishlistRow.shortId };
	},
});
