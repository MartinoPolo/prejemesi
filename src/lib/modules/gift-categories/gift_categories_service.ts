import { and, eq, isNull, sql, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	GIFT_CATEGORY_PRESETS,
	GIFT_CATEGORY_PRESET_BY_KEY,
	type GiftCategoryPresetKey,
} from './presets.js';
import {
	normalizeGiftCategoryLabel,
	presetLabelsByNormalizedValue,
	type ManagedGiftCategory,
	type PublicGiftCategory,
	type SaveGiftCategorySettingsInput,
} from './types.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import type { GiftDraftInput } from '$lib/modules/gifts/types.js';

type CategoryDatabase = ReturnType<typeof getDb> | GiftCreationTransaction;

function dbOrTx(database?: CategoryDatabase): CategoryDatabase {
	return database ?? getDb();
}

async function lockWishlistCategoryStructure(
	database: CategoryDatabase,
	wishlistId: string,
): Promise<void> {
	await database
		.select({ id: wishlist.id })
		.from(wishlist)
		.where(eq(wishlist.id, wishlistId))
		.limit(1)
		.for('update');
}

export function publicGiftCategory(row: typeof giftCategory.$inferSelect): PublicGiftCategory {
	return {
		id: row.id,
		presetKey: row.presetKey as GiftCategoryPresetKey | null,
		customLabel: row.customLabel,
		sortOrder: row.sortOrder,
	};
}

export async function getActiveGiftCategories(
	wishlistId: string,
	database?: CategoryDatabase,
): Promise<PublicGiftCategory[]> {
	const rows = await dbOrTx(database)
		.select()
		.from(giftCategory)
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.deletedAt)))
		.orderBy(giftCategory.sortOrder);
	return rows.map(publicGiftCategory);
}

export async function getManagedGiftCategories(wishlistId: string): Promise<ManagedGiftCategory[]> {
	const database = getDb();
	const rows = await database
		.select({
			id: giftCategory.id,
			presetKey: giftCategory.presetKey,
			customLabel: giftCategory.customLabel,
			sortOrder: giftCategory.sortOrder,
			usedCount: sql<number>`count(${gift.id})::int`,
		})
		.from(giftCategory)
		.leftJoin(gift, and(eq(gift.categoryId, giftCategory.id), isNull(gift.deletedAt)))
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.deletedAt)))
		.groupBy(giftCategory.id)
		.orderBy(giftCategory.sortOrder);
	return rows.map((row) => ({
		id: row.id,
		presetKey: row.presetKey as GiftCategoryPresetKey | null,
		customLabel: row.customLabel,
		sortOrder: row.sortOrder,
		usedCount: Number(row.usedCount),
	}));
}

export async function assertActiveGiftCategoryAssignment(
	database: CategoryDatabase,
	wishlistId: string,
	categoryId: string | null | undefined,
): Promise<string | null> {
	if (categoryId == null || categoryId === '') {
		return null;
	}
	const [row] = await database
		.select({ id: giftCategory.id })
		.from(giftCategory)
		.where(
			and(
				eq(giftCategory.id, categoryId),
				eq(giftCategory.wishlistId, wishlistId),
				isNull(giftCategory.deletedAt),
			),
		)
		.limit(1)
		.for('update');
	if (row === undefined) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH);
	}
	return row.id;
}

async function nextSortOrder(database: CategoryDatabase, wishlistId: string): Promise<number> {
	const [row] = await database
		.select({ maxSort: sql<number>`COALESCE(MAX(${giftCategory.sortOrder}), -1)` })
		.from(giftCategory)
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.deletedAt)));
	return Number(row?.maxSort ?? -1) + 1;
}

async function activeGiftCount(database: CategoryDatabase, categoryId: string): Promise<number> {
	const [row] = await database
		.select({ count: sql<number>`count(*)::int` })
		.from(gift)
		.where(and(eq(gift.categoryId, categoryId), isNull(gift.deletedAt)));
	return Number(row?.count ?? 0);
}

async function assertNoLabelConflict(params: {
	database: CategoryDatabase;
	wishlistId: string;
	label: string;
	excludeCategoryId?: string;
}): Promise<void> {
	const normalized = normalizeGiftCategoryLabel(params.label);
	const presetLabels = presetLabelsByNormalizedValue();
	if (presetLabels.has(normalized)) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT);
	}
	const rows = await getActiveGiftCategories(params.wishlistId, params.database);
	for (const row of rows) {
		if (row.id === params.excludeCategoryId || row.customLabel === null) {
			continue;
		}
		if (normalizeGiftCategoryLabel(row.customLabel) === normalized) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT);
		}
	}
}

export type ImportGiftCategoryResolution =
	| { action: 'map-existing'; sourceLabel: string; categoryId: string }
	| { action: 'enable-preset'; sourceLabel: string; presetKey: GiftCategoryPresetKey }
	| { action: 'create-custom'; sourceLabel: string; label: string };

async function enablePresetGiftCategoryWithDatabase(
	database: CategoryDatabase,
	params: { wishlistId: string; presetKey: GiftCategoryPresetKey },
): Promise<PublicGiftCategory> {
	if (!GIFT_CATEGORY_PRESET_BY_KEY.has(params.presetKey)) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
	}
	const [row] = await database
		.select()
		.from(giftCategory)
		.where(
			and(
				eq(giftCategory.wishlistId, params.wishlistId),
				eq(giftCategory.presetKey, params.presetKey),
			),
		)
		.limit(1)
		.for('update');
	const now = new Date();
	if (row === undefined) {
		const [created] = await database
			.insert(giftCategory)
			.values({
				wishlistId: params.wishlistId,
				presetKey: params.presetKey,
				sortOrder: await nextSortOrder(database, params.wishlistId),
			})
			.returning();
		if (created === undefined) {
			error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
		}
		return publicGiftCategory(created);
	}
	if (row.deletedAt === null) {
		return publicGiftCategory(row);
	}
	const [restored] = await database
		.update(giftCategory)
		.set({
			deletedAt: null,
			sortOrder: await nextSortOrder(database, params.wishlistId),
			updatedAt: now,
		})
		.where(eq(giftCategory.id, row.id))
		.returning();
	return publicGiftCategory(restored ?? { ...row, deletedAt: null, updatedAt: now });
}

async function createCustomGiftCategoryWithDatabase(
	database: CategoryDatabase,
	params: { wishlistId: string; label: string },
): Promise<PublicGiftCategory> {
	await assertNoLabelConflict({
		database,
		wishlistId: params.wishlistId,
		label: params.label,
	});
	const [row] = await database
		.insert(giftCategory)
		.values({
			wishlistId: params.wishlistId,
			customLabel: params.label.trim(),
			sortOrder: await nextSortOrder(database, params.wishlistId),
		})
		.returning();
	if (row === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}
	return publicGiftCategory(row);
}

export async function resolveImportGiftCategoryAssignments(params: {
	database: CategoryDatabase;
	wishlistId: string;
	drafts: readonly GiftDraftInput[];
	resolutions: readonly ImportGiftCategoryResolution[];
}): Promise<Map<string, string>> {
	const byNormalizedLabel = new Map<string, ImportGiftCategoryResolution>();
	for (const resolution of params.resolutions ?? []) {
		const normalized = normalizeGiftCategoryLabel(resolution.sourceLabel);
		if (byNormalizedLabel.has(normalized)) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_IMPORT_UNRESOLVED);
		}
		byNormalizedLabel.set(normalized, resolution);
	}

	const assignmentByImportedLabel = new Map<string, string>();
	const createdByNormalizedLabel = new Map<string, string>();
	for (const draft of params.drafts) {
		if (draft.categoryId != null && draft.categoryId !== '') {
			await assertActiveGiftCategoryAssignment(
				params.database,
				params.wishlistId,
				draft.categoryId,
			);
			continue;
		}
		const sourceLabel = draft.importedCategoryLabel?.trim() ?? '';
		if (sourceLabel === '') {
			continue;
		}
		const normalized = normalizeGiftCategoryLabel(sourceLabel);
		const cached = createdByNormalizedLabel.get(normalized);
		if (cached !== undefined) {
			assignmentByImportedLabel.set(sourceLabel, cached);
			continue;
		}
		const resolution = byNormalizedLabel.get(normalized);
		if (resolution === undefined) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_IMPORT_UNRESOLVED);
		}
		let categoryId: string | null;
		if (resolution.action === 'map-existing') {
			categoryId = await assertActiveGiftCategoryAssignment(
				params.database,
				params.wishlistId,
				resolution.categoryId,
			);
			if (categoryId === null) {
				error(400, SERVER_ERROR.GIFT_CATEGORY_IMPORT_UNRESOLVED);
			}
		} else if (resolution.action === 'enable-preset') {
			categoryId = (
				await enablePresetGiftCategoryWithDatabase(params.database, {
					wishlistId: params.wishlistId,
					presetKey: resolution.presetKey,
				})
			).id;
		} else {
			categoryId = (
				await createCustomGiftCategoryWithDatabase(params.database, {
					wishlistId: params.wishlistId,
					label: resolution.label,
				})
			).id;
		}
		createdByNormalizedLabel.set(normalized, categoryId);
		assignmentByImportedLabel.set(sourceLabel, categoryId);
	}
	return assignmentByImportedLabel;
}

export async function enablePresetGiftCategory(params: {
	wishlistId: string;
	presetKey: GiftCategoryPresetKey;
	enabled: boolean;
}): Promise<void> {
	const database = getDb();
	if (!GIFT_CATEGORY_PRESET_BY_KEY.has(params.presetKey)) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
	}
	await database.transaction(async (tx) => {
		await lockWishlistCategoryStructure(tx, params.wishlistId);
		const [row] = await tx
			.select()
			.from(giftCategory)
			.where(
				and(
					eq(giftCategory.wishlistId, params.wishlistId),
					eq(giftCategory.presetKey, params.presetKey),
				),
			)
			.limit(1)
			.for('update');
		const now = new Date();
		if (params.enabled) {
			if (row === undefined) {
				await tx.insert(giftCategory).values({
					wishlistId: params.wishlistId,
					presetKey: params.presetKey,
					sortOrder: await nextSortOrder(tx, params.wishlistId),
				});
			} else if (row.deletedAt !== null) {
				await tx
					.update(giftCategory)
					.set({
						deletedAt: null,
						sortOrder: await nextSortOrder(tx, params.wishlistId),
						updatedAt: now,
					})
					.where(eq(giftCategory.id, row.id));
			}
			return;
		}
		if (row === undefined || row.deletedAt !== null) {
			return;
		}
		if ((await activeGiftCount(tx, row.id)) > 0) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_IN_USE);
		}
		await tx
			.update(giftCategory)
			.set({ deletedAt: now, updatedAt: now })
			.where(eq(giftCategory.id, row.id));
	});
}

export async function createCustomGiftCategory(params: {
	wishlistId: string;
	label: string;
}): Promise<PublicGiftCategory> {
	const database = getDb();
	return database.transaction(async (tx) => {
		await lockWishlistCategoryStructure(tx, params.wishlistId);
		return createCustomGiftCategoryWithDatabase(tx, params);
	});
}

/**
 * Reconciles the complete settings snapshot under one wishlist lock. Existing rows are updated
 * in place so gift assignments and production IDs survive rename, reorder, and preset toggles.
 */
export async function saveGiftCategorySettings(
	params: SaveGiftCategorySettingsInput,
): Promise<void> {
	const database = getDb();
	await database.transaction(async (tx) => {
		await lockWishlistCategoryStructure(tx, params.wishlistId);
		const rows = await tx
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.wishlistId, params.wishlistId))
			.for('update');
		const byId = new Map(rows.map((row) => [row.id, row]));
		const requestedIds = params.customCategories.flatMap((item) => item.id ?? []);
		if (
			new Set(requestedIds).size !== requestedIds.length ||
			requestedIds.some((id) => {
				const row = byId.get(id);
				return row === undefined || row.presetKey !== null || row.deletedAt !== null;
			})
		) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH);
		}
		if (new Set(params.presetKeys).size !== params.presetKeys.length) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH);
		}

		const normalizedLabels = new Set<string>();
		const presetLabels = presetLabelsByNormalizedValue();
		for (const item of params.customCategories) {
			const normalized = normalizeGiftCategoryLabel(item.label);
			if (presetLabels.has(normalized) || normalizedLabels.has(normalized)) {
				error(400, SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT);
			}
			normalizedLabels.add(normalized);
		}

		const now = new Date();
		const keptIds = new Set(requestedIds);
		for (const row of rows) {
			if (row.presetKey === null && row.deletedAt === null && !keptIds.has(row.id)) {
				if ((await activeGiftCount(tx, row.id)) > 0) {
					error(400, SERVER_ERROR.GIFT_CATEGORY_IN_USE);
				}
				await tx
					.update(giftCategory)
					.set({ deletedAt: now, updatedAt: now })
					.where(eq(giftCategory.id, row.id));
			}
		}

		const orderedIds: string[] = [];
		for (const item of params.customCategories) {
			if (item.id === null) {
				const [created] = await tx
					.insert(giftCategory)
					.values({
						wishlistId: params.wishlistId,
						customLabel: item.label,
						sortOrder: orderedIds.length,
					})
					.returning();
				if (created === undefined) {
					error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
				}
				orderedIds.push(created.id);
			} else {
				await tx
					.update(giftCategory)
					.set({ customLabel: item.label, updatedAt: now })
					.where(eq(giftCategory.id, item.id));
				orderedIds.push(item.id);
			}
		}

		for (const preset of GIFT_CATEGORY_PRESETS) {
			const enabled = params.presetKeys.includes(preset.key);
			const row = rows.find((candidate) => candidate.presetKey === preset.key);
			if (!enabled) {
				if (row?.deletedAt === null) {
					if ((await activeGiftCount(tx, row.id)) > 0) {
						error(400, SERVER_ERROR.GIFT_CATEGORY_IN_USE);
					}
					await tx
						.update(giftCategory)
						.set({ deletedAt: now, updatedAt: now })
						.where(eq(giftCategory.id, row.id));
				}
				continue;
			}
			if (row === undefined) {
				const [created] = await tx
					.insert(giftCategory)
					.values({
						wishlistId: params.wishlistId,
						presetKey: preset.key,
						sortOrder: orderedIds.length,
					})
					.returning();
				if (created === undefined) {
					error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
				}
				orderedIds.push(created.id);
			} else {
				await tx
					.update(giftCategory)
					.set({ deletedAt: null, updatedAt: now })
					.where(eq(giftCategory.id, row.id));
				orderedIds.push(row.id);
			}
		}
		for (const [sortOrder, id] of orderedIds.entries()) {
			await tx
				.update(giftCategory)
				.set({ sortOrder, updatedAt: now })
				.where(eq(giftCategory.id, id));
		}
	});
}

export async function renameCustomGiftCategory(params: {
	categoryId: string;
	label: string;
}): Promise<void> {
	const database = getDb();
	await database.transaction(async (tx) => {
		const [categoryIdentity] = await tx
			.select({ wishlistId: giftCategory.wishlistId })
			.from(giftCategory)
			.where(eq(giftCategory.id, params.categoryId))
			.limit(1);
		if (categoryIdentity === undefined) {
			error(404, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
		}
		await lockWishlistCategoryStructure(tx, categoryIdentity.wishlistId);
		const [row] = await tx
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.id, params.categoryId))
			.limit(1)
			.for('update');
		if (row === undefined || row.deletedAt !== null) {
			error(404, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
		}
		if (row.presetKey !== null) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_PRESET_IMMUTABLE);
		}
		const trimmed = params.label.trim();
		if (trimmed === row.customLabel) {
			return;
		}
		await assertNoLabelConflict({
			database: tx,
			wishlistId: row.wishlistId,
			label: trimmed,
			excludeCategoryId: row.id,
		});
		const now = new Date();
		await tx
			.update(giftCategory)
			.set({ customLabel: trimmed, updatedAt: now })
			.where(eq(giftCategory.id, row.id));
	});
}

export async function deleteCustomGiftCategory(categoryId: string): Promise<void> {
	const database = getDb();
	await database.transaction(async (tx) => {
		const [categoryIdentity] = await tx
			.select({ wishlistId: giftCategory.wishlistId })
			.from(giftCategory)
			.where(eq(giftCategory.id, categoryId))
			.limit(1);
		if (categoryIdentity === undefined) {
			error(404, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
		}
		await lockWishlistCategoryStructure(tx, categoryIdentity.wishlistId);
		const [row] = await tx
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.id, categoryId))
			.limit(1)
			.for('update');
		if (row === undefined || row.deletedAt !== null) {
			error(404, SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND);
		}
		if (row.presetKey !== null) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_PRESET_IMMUTABLE);
		}
		if ((await activeGiftCount(tx, row.id)) > 0) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_IN_USE);
		}
		await tx
			.update(giftCategory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(giftCategory.id, row.id));
	});
}

export async function reorderActiveGiftCategories(params: {
	wishlistId: string;
	categoryIds: readonly string[];
}): Promise<void> {
	const database = getDb();
	await database.transaction(async (tx) => {
		await lockWishlistCategoryStructure(tx, params.wishlistId);
		const rows = await tx
			.select({ id: giftCategory.id })
			.from(giftCategory)
			.where(
				and(eq(giftCategory.wishlistId, params.wishlistId), isNull(giftCategory.deletedAt)),
			);
		const activeIds = rows.map((row) => row.id);
		if (
			activeIds.length !== params.categoryIds.length ||
			new Set(params.categoryIds).size !== params.categoryIds.length ||
			activeIds.some((id) => !params.categoryIds.includes(id))
		) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH);
		}
		if (params.categoryIds.length === 0) {
			return;
		}
		const sortOrderCase = sql.join(
			params.categoryIds.map(
				(id, sortOrder) => sql`WHEN ${giftCategory.id} = ${id} THEN ${sortOrder}::integer`,
			),
			sql` `,
		);
		await tx
			.update(giftCategory)
			.set({ sortOrder: sql<number>`CASE ${sortOrderCase} END`, updatedAt: new Date() })
			.where(inArray(giftCategory.id, [...params.categoryIds]));
	});
}

export function presetSortOrder(presetKey: GiftCategoryPresetKey): number {
	return GIFT_CATEGORY_PRESETS.findIndex((preset) => preset.key === presetKey);
}
