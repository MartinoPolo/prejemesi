import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift } from '$lib/server/db/gift.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import {
	BulkUpdateGiftsInputSchema,
	GIFT_GROUPING_OPTIONS,
	ReorderGiftsInputSchema,
	type GiftReorderGroupField,
} from '$lib/modules/gifts/types.js';
import {
	bulkGiftUpdateData,
	isBulkPresentationAction,
} from '$lib/modules/gifts/gift_bulk_update.js';
import { runBulkUpdateAfterRowsLockedHookForTest } from './gift_bulk_operations.test-hook.js';
import {
	BulkCopyGiftsInputSchema,
	copyPreparedGifts,
	prepareGiftCopy,
	type PreparedGiftCopy,
} from '$lib/modules/gifts/gift_bulk_copy.js';
import { assertActiveGiftCategoryAssignment } from '$lib/modules/gift-categories/gift_categories_service.js';
import { OPERATION_KIND, defineOperation, type MutationOperationContext } from './operation.js';
import { assertWishlistPriorityLevel, requireWishlistManagement } from './wishlist_management.js';
import {
	planPresentationUpdate,
	updateDataChangesGift,
	type GiftRow,
	type GiftUpdateData,
} from './gift_update.js';
import type { ManagedWishlist } from './wishlist_management.js';

function bulkJsonbValue(value: unknown) {
	return value === null ? sql`NULL::jsonb` : sql`${JSON.stringify(value)}::jsonb`;
}

function bulkTimestampValue(value: Date | null) {
	return value === null ? sql`NULL::timestamptz` : sql`${value.toISOString()}::timestamptz`;
}

/** Správce presentation edits to reserved gifts are coalesced into one notice per reserver. */
function noteManagerEdits(
	context: MutationOperationContext,
	managedWishlist: ManagedWishlist,
	changedGifts: readonly GiftRow[],
): void {
	if (managedWishlist.role !== WISHLIST_ROLES.moderator) {
		return;
	}
	const { wishlistRow } = managedWishlist;
	context.noteReservedGiftEdits(
		changedGifts.map((changedGift) => ({
			giftId: changedGift.id,
			giftName: changedGift.name,
			wishlistId: changedGift.wishlistId,
			wishlist: { title: wishlistRow.title, shortId: wishlistRow.shortId },
		})),
	);
}

export const reorderGiftsOperation = defineOperation({
	name: 'reorderGifts',
	kind: OPERATION_KIND.mutation,
	input: ReorderGiftsInputSchema,
	async run(context, { wishlistId, orderedGiftIds, groupChanges = [] }) {
		const { transaction, now } = context;
		const managedWishlist = await requireWishlistManagement(
			transaction,
			context.actor.userId,
			wishlistId,
			{ lock: true },
		);
		const { wishlistRow } = managedWishlist;
		assertWishlistMutable(wishlistRow);

		const giftRows = await transaction
			.select()
			.from(gift)
			.where(and(eq(gift.wishlistId, wishlistId), isNull(gift.deletedAt)))
			.for('update');
		const activeGiftRowsById = new Map(
			giftRows.filter((row) => !row.received).map((row) => [row.id, row]),
		);
		const isCompleteActiveSet =
			orderedGiftIds.length === activeGiftRowsById.size &&
			new Set(orderedGiftIds).size === orderedGiftIds.length &&
			orderedGiftIds.every((id) => activeGiftRowsById.has(id));
		const groupChangeRows = groupChanges.flatMap((change) => {
			const giftRow = activeGiftRowsById.get(change.giftId);
			return giftRow === undefined ? [] : [{ change, giftRow }];
		});
		if (!isCompleteActiveSet || groupChangeRows.length !== groupChanges.length) {
			error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
		}
		const wishlistShortId = wishlistRow.shortId;
		if (orderedGiftIds.length === 0) {
			return { wishlistShortId, changedGroupFields: [] };
		}

		const updatePlans: Array<
			ReturnType<typeof planPresentationUpdate> & { field: GiftReorderGroupField }
		> = [];
		for (const { change, giftRow } of groupChangeRows) {
			const updateData: GiftUpdateData = {};
			if (change.field === GIFT_GROUPING_OPTIONS.priority) {
				await assertWishlistPriorityLevel(transaction, wishlistId, change.value);
				updateData.priorityLevelId = change.value;
			} else {
				updateData.categoryId = await assertActiveGiftCategoryAssignment(
					transaction,
					wishlistId,
					change.value,
				);
			}
			updatePlans.push({
				field: change.field,
				...planPresentationUpdate({ giftRow, updateData, now, wishlistRow }),
			});
		}

		// Batch update sortOrder in a single CASE WHEN statement
		const sortOrderCase = sql.join(
			orderedGiftIds.map(
				(id, sortOrder) => sql`WHEN ${gift.id} = ${id} THEN ${sortOrder}::integer`,
			),
			sql` `,
		);
		await transaction
			.update(gift)
			.set({
				sortOrder: sql<number>`CASE ${sortOrderCase} END`,
				updatedAt: now,
			})
			.where(and(inArray(gift.id, orderedGiftIds), eq(gift.wishlistId, wishlistId)));

		const changedPlans = updatePlans.filter((plan) => plan.didChange);
		for (const plan of changedPlans) {
			await transaction
				.update(gift)
				.set({ ...plan.updateData, updatedAt: now })
				.where(eq(gift.id, plan.giftRow.id));
		}

		// Order alone is a list-level change with its own undo, so only group changes are revisions.
		context.recordGiftRevisions(
			changedPlans.map((plan) => ({
				giftId: plan.giftRow.id,
				wishlistId,
				before: plan.giftRow,
				after: { ...plan.giftRow, ...plan.updateData },
			})),
		);
		noteManagerEdits(
			context,
			managedWishlist,
			changedPlans.map((plan) => plan.giftRow),
		);
		return {
			wishlistShortId,
			changedGroupFields: changedPlans.map((plan) => plan.field),
		};
	},
});

export const bulkUpdateGiftsOperation = defineOperation({
	name: 'bulkUpdateGifts',
	kind: OPERATION_KIND.mutation,
	input: BulkUpdateGiftsInputSchema,
	async run(context, input) {
		const { transaction, now } = context;
		const uniqueGiftIds = [...new Set(input.giftIds)];
		const managedWishlist = await requireWishlistManagement(
			transaction,
			context.actor.userId,
			input.wishlistId,
			{ lock: true },
		);
		const { wishlistRow } = managedWishlist;
		assertWishlistMutable(wishlistRow);
		if (input.action === 'priority') {
			await assertWishlistPriorityLevel(transaction, input.wishlistId, input.priorityLevelId);
		}
		if (input.action === 'category') {
			await assertActiveGiftCategoryAssignment(
				transaction,
				input.wishlistId,
				input.categoryId,
			);
		}

		const rows = await transaction
			.select()
			.from(gift)
			.where(
				and(
					inArray(gift.id, uniqueGiftIds),
					eq(gift.wishlistId, input.wishlistId),
					isNull(gift.deletedAt),
				),
			)
			.for('update');
		if (rows.length !== uniqueGiftIds.length) {
			error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
		}
		if (
			input.action === 'restoreReceived' &&
			uniqueGiftIds.some((id) => input.states[id] === undefined)
		) {
			error(400, SERVER_ERROR.BULK_GIFT_STATE_MISMATCH);
		}

		const updatePlans = rows.map((row) => {
			const updateData: GiftUpdateData = bulkGiftUpdateData(input, row);
			if (isBulkPresentationAction(input)) {
				const plan = planPresentationUpdate({
					giftRow: row,
					updateData,
					now,
					wishlistRow,
				});
				return { row, updateData, didChange: plan.didChange };
			}
			return { row, updateData, didChange: updateDataChangesGift(row, updateData) };
		});
		const changedPresentationPlans = updatePlans.filter(
			(plan) => plan.didChange && isBulkPresentationAction(input),
		);

		const updateSet: Record<string, unknown> = { updatedAt: now };
		switch (input.action) {
			case 'priority':
				updateSet.priorityLevelId = input.priorityLevelId;
				break;
			case 'category':
				updateSet.categoryId = input.categoryId;
				break;
			case 'received':
				updateSet.received = input.received;
				break;
			case 'restoreReceived': {
				const receivedCase = sql.join(
					updatePlans.map(
						(plan) =>
							sql`WHEN ${gift.id} = ${plan.row.id} THEN ${plan.updateData.received ?? false}::boolean`,
					),
					sql` `,
				);
				updateSet.received = sql<boolean>`CASE ${receivedCase} ELSE ${gift.received} END`;
				break;
			}
			case 'imageFit':
			case 'imageBackground': {
				const imageMetaCase = sql.join(
					updatePlans.map(
						(plan) =>
							sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkJsonbValue(plan.updateData.imageMeta ?? null)}`,
					),
					sql` `,
				);
				updateSet.imageMeta = sql`CASE ${imageMetaCase} ELSE ${gift.imageMeta} END`;
				break;
			}
		}

		if (changedPresentationPlans.length > 0 && wishlistRow.sharedAt !== null) {
			const editedAfterShareCase = sql.join(
				changedPresentationPlans.map(
					(plan) =>
						sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkTimestampValue(
							plan.updateData.editedAfterShareAt === undefined
								? plan.row.editedAfterShareAt
								: plan.updateData.editedAfterShareAt,
						)}`,
				),
				sql` `,
			);
			const preEditShareSnapshotCase = sql.join(
				changedPresentationPlans.map(
					(plan) =>
						sql`WHEN ${gift.id} = ${plan.row.id} THEN ${bulkJsonbValue(
							'preEditShareSnapshot' in plan.updateData
								? plan.updateData.preEditShareSnapshot
								: plan.row.preEditShareSnapshot,
						)}`,
				),
				sql` `,
			);
			updateSet.editedAfterShareAt = sql<Date | null>`CASE ${editedAfterShareCase} ELSE ${gift.editedAfterShareAt} END`;
			updateSet.preEditShareSnapshot = sql`CASE ${preEditShareSnapshotCase} ELSE ${gift.preEditShareSnapshot} END`;
		}

		await runBulkUpdateAfterRowsLockedHookForTest(transaction);

		const updatedRows = await transaction
			.update(gift)
			.set(updateSet)
			.where(
				and(
					inArray(gift.id, uniqueGiftIds),
					eq(gift.wishlistId, input.wishlistId),
					isNull(gift.deletedAt),
				),
			)
			.returning({ id: gift.id });
		const updatedIdSet = new Set(updatedRows.map((row) => row.id));
		if (
			updatedRows.length !== uniqueGiftIds.length ||
			updatedIdSet.size !== uniqueGiftIds.length ||
			uniqueGiftIds.some((id) => !updatedIdSet.has(id))
		) {
			error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
		}

		// The CASE statements above write exactly each plan's update data, so the new state is known.
		context.recordGiftRevisions(
			updatePlans.map((plan) => ({
				giftId: plan.row.id,
				wishlistId: plan.row.wishlistId,
				before: plan.row,
				after: { ...plan.row, ...plan.updateData },
			})),
		);
		noteManagerEdits(
			context,
			managedWishlist,
			changedPresentationPlans.map((plan) => plan.row),
		);
		return {
			updatedIds: updatedRows.map((row) => row.id),
			priorReceived: Object.fromEntries(rows.map((row) => [row.id, row.received])),
			wishlistShortId: wishlistRow.shortId,
		};
	},
});

/**
 * Copies portable gift data into another managed wishlist. Image objects are staged before the
 * transaction and either kept (commit) or removed (failure, dry run never stages).
 */
export const bulkCopyGiftsOperation = defineOperation({
	name: 'bulkCopyGifts',
	kind: OPERATION_KIND.mutation,
	input: BulkCopyGiftsInputSchema,
	async prepare(actor, input, { dryRun }) {
		const preparedCopy: PreparedGiftCopy = await prepareGiftCopy(actor.userId, input, {
			stageImages: !dryRun,
		});
		return {
			value: preparedCopy,
			onCommitted: () => preparedCopy.complete(),
			onAbandoned: () => preparedCopy.abandon(),
		};
	},
	async run(context, input, preparedCopy) {
		const { created, destinationShortId } = await copyPreparedGifts(
			context.transaction,
			context.actor.userId,
			input,
			preparedCopy,
			context.recordGiftRevisions,
		);
		return { createdIds: created.map((row) => row.id), destinationShortId };
	},
});
