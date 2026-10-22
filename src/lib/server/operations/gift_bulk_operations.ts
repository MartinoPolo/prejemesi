import { and, eq, inArray, isNull, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { gift } from '$lib/server/db/gift.schema.js';
import type { DatabaseTransaction } from '$lib/server/db/index.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { assertWishlistMutable } from '$lib/modules/wishlists/wishlist_access.js';
import {
	BulkUpdateGiftsInputSchema,
	GIFT_GROUPING_OPTIONS,
	ReorderGiftsInputSchema,
	type BulkUpdateGiftsInput,
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
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { assertWishlistPriorityLevel, requireWishlistManagement } from './wishlist_management.js';
import {
	planPresentationUpdate,
	updateDataChangesGift,
	type GiftRow,
	type GiftUpdateData,
} from './gift_update.js';
import type { ManagedWishlist, WishlistRow } from './wishlist_management.js';
import { loadReservedGiftIds, managerEditNotifiesReservers } from './wishlist_kind_rules.js';
import { softDeleteGift } from './gift_deletion.js';

function bulkJsonbValue(value: unknown) {
	return value === null ? sql`NULL::jsonb` : sql`${JSON.stringify(value)}::jsonb`;
}

function bulkTimestampValue(value: Date | null) {
	return value === null ? sql`NULL::timestamptz` : sql`${value.toISOString()}::timestamptz`;
}

/** Presentation edits to reserved gifts are coalesced into one notice per reserver. */
function noteManagerEdits(
	context: MutationOperationContext,
	managedWishlist: ManagedWishlist,
	changedGifts: readonly GiftRow[],
): void {
	if (!managerEditNotifiesReservers(managedWishlist)) {
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
	exposure: OPERATION_EXPOSURE.agent,
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

		// Revisions leave sort order out; a proposal batch stores the order it replaced instead.
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

interface BulkUpdatePlan {
	row: GiftRow;
	updateData: GiftUpdateData;
	didChange: boolean;
}

async function assertBulkActionTargetActive(
	transaction: DatabaseTransaction,
	input: BulkUpdateGiftsInput,
): Promise<void> {
	if (input.action === 'priority') {
		await assertWishlistPriorityLevel(transaction, input.wishlistId, input.priorityLevelId);
	}
	if (input.action === 'category') {
		await assertActiveGiftCategoryAssignment(transaction, input.wishlistId, input.categoryId);
	}
}

function bulkSelectionFilter(input: BulkUpdateGiftsInput, uniqueGiftIds: readonly string[]) {
	return and(
		inArray(gift.id, uniqueGiftIds),
		eq(gift.wishlistId, input.wishlistId),
		isNull(gift.deletedAt),
	);
}

async function lockBulkSelection(
	transaction: DatabaseTransaction,
	input: BulkUpdateGiftsInput,
	uniqueGiftIds: readonly string[],
): Promise<GiftRow[]> {
	const rows = await transaction
		.select()
		.from(gift)
		.where(bulkSelectionFilter(input, uniqueGiftIds))
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
	return rows;
}

function planBulkUpdate(
	input: BulkUpdateGiftsInput,
	row: GiftRow,
	now: Date,
	wishlistRow: WishlistRow,
): BulkUpdatePlan {
	const updateData: GiftUpdateData = bulkGiftUpdateData(input, row);
	if (isBulkPresentationAction(input)) {
		const plan = planPresentationUpdate({ giftRow: row, updateData, now, wishlistRow });
		return { row, updateData, didChange: plan.didChange };
	}
	return { row, updateData, didChange: updateDataChangesGift(row, updateData) };
}

/** One CASE expression writes each planned gift its own value in a single UPDATE statement. */
function valueByGiftId(
	plans: readonly BulkUpdatePlan[],
	valueForPlan: (plan: BulkUpdatePlan) => SQL,
	unchangedValue: AnyColumn,
): SQL {
	const branches = sql.join(
		plans.map((plan) => sql`WHEN ${gift.id} = ${plan.row.id} THEN ${valueForPlan(plan)}`),
		sql` `,
	);
	return sql`CASE ${branches} ELSE ${unchangedValue} END`;
}

function actionUpdateSet(
	input: BulkUpdateGiftsInput,
	updatePlans: readonly BulkUpdatePlan[],
): Record<string, unknown> {
	switch (input.action) {
		case 'priority':
			return { priorityLevelId: input.priorityLevelId };
		case 'category':
			return { categoryId: input.categoryId };
		case 'received':
			return { received: input.received };
		case 'restoreReceived':
			return {
				received: valueByGiftId(
					updatePlans,
					(plan) => sql`${plan.updateData.received ?? false}::boolean`,
					gift.received,
				),
			};
		case 'imageFit':
		case 'imageBackground':
			return {
				imageMeta: valueByGiftId(
					updatePlans,
					(plan) => bulkJsonbValue(plan.updateData.imageMeta ?? null),
					gift.imageMeta,
				),
			};
	}
}

function postShareTransparencyUpdateSet(
	changedPresentationPlans: readonly BulkUpdatePlan[],
): Record<string, unknown> {
	if (changedPresentationPlans.length === 0) {
		return {};
	}
	return {
		editedAfterShareAt: valueByGiftId(
			changedPresentationPlans,
			(plan) =>
				bulkTimestampValue(
					plan.updateData.editedAfterShareAt === undefined
						? plan.row.editedAfterShareAt
						: plan.updateData.editedAfterShareAt,
				),
			gift.editedAfterShareAt,
		),
		preEditShareSnapshot: valueByGiftId(
			changedPresentationPlans,
			(plan) =>
				bulkJsonbValue(
					'preEditShareSnapshot' in plan.updateData
						? plan.updateData.preEditShareSnapshot
						: plan.row.preEditShareSnapshot,
				),
			gift.preEditShareSnapshot,
		),
	};
}

function assertEveryGiftUpdated(
	updatedRows: readonly { id: string }[],
	uniqueGiftIds: readonly string[],
): void {
	const updatedIdSet = new Set(updatedRows.map((row) => row.id));
	if (
		updatedRows.length !== uniqueGiftIds.length ||
		updatedIdSet.size !== uniqueGiftIds.length ||
		uniqueGiftIds.some((id) => !updatedIdSet.has(id))
	) {
		error(400, SERVER_ERROR.GIFT_WISHLIST_MISMATCH);
	}
}

/** Applies one bulk action inside the caller's transaction, through the post-share edit rules. */
export async function applyBulkGiftUpdate(
	context: MutationOperationContext,
	input: BulkUpdateGiftsInput,
) {
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
	await assertBulkActionTargetActive(transaction, input);
	const rows = await lockBulkSelection(transaction, input, uniqueGiftIds);

	const updatePlans = rows.map((row) => planBulkUpdate(input, row, now, wishlistRow));
	const changedPresentationPlans = updatePlans.filter(
		(plan) => plan.didChange && isBulkPresentationAction(input),
	);
	const updateSet: Record<string, unknown> = {
		updatedAt: now,
		...actionUpdateSet(input, updatePlans),
		...(wishlistRow.sharedAt === null
			? {}
			: postShareTransparencyUpdateSet(changedPresentationPlans)),
	};

	await runBulkUpdateAfterRowsLockedHookForTest(transaction);

	const updatedRows = await transaction
		.update(gift)
		.set(updateSet)
		.where(bulkSelectionFilter(input, uniqueGiftIds))
		.returning({ id: gift.id });
	assertEveryGiftUpdated(updatedRows, uniqueGiftIds);

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
}

export const bulkUpdateGiftsOperation = defineOperation({
	name: 'bulkUpdateGifts',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: BulkUpdateGiftsInputSchema,
	run: applyBulkGiftUpdate,
});

/**
 * Removes the copied source gifts nobody reserved through the ordinary deletion rules; reserved
 * sources stay untouched with their reservations and likes. Each copy owns its own staged image
 * object, so deleting a source's image never affects the copy.
 */
async function removeUnreservedSourceGifts(
	context: MutationOperationContext,
	sourceWishlistId: string,
	giftIds: readonly string[],
): Promise<string[]> {
	const { transaction } = context;
	const managedSource = await requireWishlistManagement(
		transaction,
		context.actor.userId,
		sourceWishlistId,
		{ lock: true },
	);
	const sourceGiftRows = await transaction
		.select()
		.from(gift)
		.where(
			and(
				inArray(gift.id, [...giftIds]),
				eq(gift.wishlistId, sourceWishlistId),
				isNull(gift.deletedAt),
			),
		)
		.for('update');
	const reservedGiftIds = await loadReservedGiftIds(
		transaction,
		sourceGiftRows.map((row) => row.id),
	);
	const unreservedSourceGiftRows = sourceGiftRows.filter((row) => !reservedGiftIds.has(row.id));
	for (const sourceGiftRow of unreservedSourceGiftRows) {
		await softDeleteGift(context, sourceGiftRow, managedSource, {
			hasActiveReservation: false,
		});
	}
	return unreservedSourceGiftRows.map((row) => row.id);
}

/**
 * Copies portable gift data into another managed wishlist, optionally removing the unreserved
 * sources from a permanent wishlist. Image objects are staged before the transaction and either
 * kept (commit) or removed (failure, dry run never stages).
 */
export const bulkCopyGiftsOperation = defineOperation({
	name: 'bulkCopyGifts',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
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
		const { created, destinationShortId, sourceShortId } = await copyPreparedGifts(
			context.transaction,
			context.actor.userId,
			input,
			preparedCopy,
			context.recordGiftRevisions,
		);
		const removedSourceIds =
			input.removeUnreservedSources === true
				? await removeUnreservedSourceGifts(context, input.sourceWishlistId, input.giftIds)
				: [];
		return {
			createdIds: created.map((row) => row.id),
			removedSourceIds,
			destinationShortId,
			sourceShortId,
		};
	},
});
