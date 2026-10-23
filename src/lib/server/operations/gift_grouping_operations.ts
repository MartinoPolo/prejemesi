import * as v from 'valibot';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { priorityLevel } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CreateGiftCategoryInputSchema,
	SaveGiftCategorySettingsInputSchema,
} from '$lib/modules/gift-categories/types.js';
import {
	createCustomGiftCategory,
	getManagedGiftCategories,
	getManagedGiftCategorySettingsRows,
	saveGiftCategorySettings,
} from '$lib/modules/gift-categories/gift_categories_service.js';
import { SavePriorityLevelsInputSchema, type PriorityLevel } from '$lib/modules/wishlists/types.js';
import {
	OPERATION_EXPOSURE,
	OPERATION_KIND,
	defineOperation,
	type MutationOperationContext,
} from './operation.js';
import { requireOperationActor, type OperationActor } from './actor.js';
import { requireMutableManagedWishlist, requireWishlistManagement } from './wishlist_management.js';
import { applyBulkGiftUpdate } from './gift_bulk_operations.js';

/** Category settings, including usage counts, are for managers only. */
async function requireCategoryManager(
	actor: OperationActor | null,
	wishlistId: string,
): Promise<void> {
	const managingActor = requireOperationActor(actor);
	await requireWishlistManagement(getDb(), managingActor.userId, wishlistId, { lock: false });
}

/**
 * The enabled categories with usage counts. The first read of a wishlist without category rows
 * inserts the default set: an idempotent write that a read-only scope must still permit.
 */
export const readGiftCategoriesOperation = defineOperation({
	name: 'readGiftCategories',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistId: v.string() }),
	async run(context, { wishlistId }) {
		await requireCategoryManager(context.actor, wishlistId);
		return getManagedGiftCategories(wishlistId);
	},
});

/**
 * Every category row, enabled or not. Superseded by {@link readGiftCategoriesOperation}, which the
 * category settings now read; kept for existing agent clients. The first read likewise inserts the
 * default set.
 */
export const readGiftCategorySettingsRowsOperation = defineOperation({
	name: 'readGiftCategorySettingsRows',
	kind: OPERATION_KIND.read,
	exposure: OPERATION_EXPOSURE.agent,
	input: v.strictObject({ wishlistId: v.string() }),
	async run(context, { wishlistId }) {
		await requireCategoryManager(context.actor, wishlistId);
		return getManagedGiftCategorySettingsRows(wishlistId);
	},
});

/**
 * Reconciles the complete ordered category list. Removing a category unassigns its gifts, which
 * records a revision for each of them.
 */
export const saveGiftCategorySettingsOperation = defineOperation({
	name: 'saveGiftCategorySettings',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: SaveGiftCategorySettingsInputSchema,
	async run(context, input) {
		const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
			lock: false,
		});
		await saveGiftCategorySettings(input, context);
		return { wishlistShortId: wishlistRow.shortId };
	},
});

/**
 * Creates a custom category from a category picker and assigns it to the gifts the picker acted
 * on, atomically and through the ordinary bulk post-share rules. Agents compose the same change
 * from the category settings and bulk update operations.
 */
export const createGiftCategoryOperation = defineOperation({
	name: 'createGiftCategory',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.humanOnly,
	input: CreateGiftCategoryInputSchema,
	async run(context, { wishlistId, label, color, giftIds }) {
		// The wishlist lock serializes structure changes against concurrent gift assignment.
		const wishlistRow = await requireMutableManagedWishlist(context, wishlistId, {
			lock: true,
		});
		const category = await createCustomGiftCategory(context.transaction, {
			wishlistId,
			label,
			color,
		});
		if (giftIds.length > 0) {
			await applyBulkGiftUpdate(context, {
				wishlistId,
				giftIds,
				action: 'category',
				categoryId: category.id,
			});
		}
		return { category, wishlistShortId: wishlistRow.shortId };
	},
});

/**
 * Unassigns the removed levels from the wishlist's live gifts, then deletes the levels; the
 * foreign key also clears them from soft-deleted gifts, which get no revision.
 */
async function removePriorityLevels(
	context: MutationOperationContext,
	wishlistId: string,
	removedLevelIds: readonly string[],
): Promise<void> {
	if (removedLevelIds.length === 0) {
		return;
	}
	const assignedToRemovedLevel = and(
		eq(gift.wishlistId, wishlistId),
		inArray(gift.priorityLevelId, [...removedLevelIds]),
		isNull(gift.deletedAt),
	);
	// An UPDATE cannot return the replaced level, so the gifts are read and locked first.
	const giftsBefore = await context.transaction
		.select()
		.from(gift)
		.where(assignedToRemovedLevel)
		.orderBy(gift.id)
		.for('update');
	const giftBeforeById = new Map(giftsBefore.map((giftRow) => [giftRow.id, giftRow]));
	const unassignedGifts = await context.transaction
		.update(gift)
		.set({ priorityLevelId: null, updatedAt: context.now })
		.where(assignedToRemovedLevel)
		.returning();
	context.recordGiftRevisions(
		unassignedGifts.flatMap((unassignedGift) => {
			const giftBefore = giftBeforeById.get(unassignedGift.id);
			return giftBefore === undefined
				? []
				: [
						{
							giftId: unassignedGift.id,
							wishlistId,
							before: giftBefore,
							after: unassignedGift,
						},
					];
		}),
	);
	await context.transaction
		.delete(priorityLevel)
		.where(inArray(priorityLevel.id, [...removedLevelIds]));
}

async function writePriorityLevel(
	context: MutationOperationContext,
	wishlistId: string,
	level: { id: string | null; label: string; sortOrder: number },
): Promise<PriorityLevel | undefined> {
	const [written] =
		level.id === null
			? await context.transaction
					.insert(priorityLevel)
					.values({ wishlistId, label: level.label, sortOrder: level.sortOrder })
					.returning()
			: await context.transaction
					.update(priorityLevel)
					.set({ label: level.label, sortOrder: level.sortOrder })
					.where(eq(priorityLevel.id, level.id))
					.returning();
	return written;
}

/**
 * Renames, adds, reorders and removes priority levels in one step. A removed level leaves its
 * gifts without a priority (recorded as gift revisions), as deleting it would through the schema.
 */
export const savePriorityLevelsOperation = defineOperation({
	name: 'savePriorityLevels',
	kind: OPERATION_KIND.mutation,
	exposure: OPERATION_EXPOSURE.agent,
	input: SavePriorityLevelsInputSchema,
	async run(context, input) {
		// The wishlist lock serializes structure changes against concurrent gift assignment.
		const wishlistRow = await requireMutableManagedWishlist(context, input.wishlistId, {
			lock: true,
		});
		const existingLevels = await context.transaction
			.select({ id: priorityLevel.id })
			.from(priorityLevel)
			.where(eq(priorityLevel.wishlistId, input.wishlistId))
			.for('update');
		const existingLevelIds = new Set(existingLevels.map((level) => level.id));
		const keptLevelIds = input.levels.flatMap((level) => level.id ?? []);
		if (
			new Set(keptLevelIds).size !== keptLevelIds.length ||
			keptLevelIds.some((levelId) => !existingLevelIds.has(levelId))
		) {
			error(400, SERVER_ERROR.GIFT_PRIORITY_WISHLIST_MISMATCH);
		}
		await removePriorityLevels(
			context,
			input.wishlistId,
			[...existingLevelIds].filter((levelId) => !keptLevelIds.includes(levelId)),
		);
		const levels: PriorityLevel[] = [];
		for (const [index, level] of input.levels.entries()) {
			const written = await writePriorityLevel(context, input.wishlistId, {
				...level,
				sortOrder: index + 1,
			});
			if (written !== undefined) {
				levels.push(written);
			}
		}
		return { levels, wishlistShortId: wishlistRow.shortId };
	},
});
