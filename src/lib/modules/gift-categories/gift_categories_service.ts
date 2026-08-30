import { and, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import { gift, giftCategory } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS,
	GIFT_CATEGORY_PRESETS,
	GIFT_CATEGORY_PRESET_BY_KEY,
	type GiftCategoryPresetKey,
} from './presets.js';
import {
	MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
	normalizeGiftCategoryLabel,
	presetLabelsByNormalizedValue,
	type ManagedGiftCategory,
	type ManagedGiftCategorySettingsRow,
	type PublicGiftCategory,
	type SaveGiftCategorySettingsInput,
} from './types.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import type { GiftDraftInput } from '$lib/modules/gifts/types.js';
import { giftCategoryColorForIndex } from './gift_category_colors.js';

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
		color: row.color,
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

async function ensureDefaultGiftCategories(wishlistId: string): Promise<void> {
	const database = getDb();
	await database.transaction(async (tx) => {
		await lockWishlistCategoryStructure(tx, wishlistId);
		const existing = await tx
			.select({ id: giftCategory.id })
			.from(giftCategory)
			.where(eq(giftCategory.wishlistId, wishlistId))
			.limit(1);
		// Any row, including a soft-deleted one, proves that settings were explicitly saved.
		// This preserves an intentional all-disabled configuration.
		if (existing.length > 0) {
			return;
		}
		await tx.insert(giftCategory).values(
			DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS.map((key, sortOrder) => ({
				wishlistId,
				presetKey: key,
				color: GIFT_CATEGORY_PRESET_BY_KEY.get(key)!.color,
				sortOrder,
			})),
		);
	});
}

function loadManagedGiftCategoryRows(database: CategoryDatabase, wishlistId: string) {
	return database
		.select({
			id: giftCategory.id,
			presetKey: giftCategory.presetKey,
			customLabel: giftCategory.customLabel,
			color: giftCategory.color,
			sortOrder: giftCategory.sortOrder,
			deletedAt: giftCategory.deletedAt,
			usedCount: sql<number>`count(${gift.id})::int`,
		})
		.from(giftCategory)
		.leftJoin(gift, and(eq(gift.categoryId, giftCategory.id), isNull(gift.deletedAt)))
		.where(eq(giftCategory.wishlistId, wishlistId))
		.groupBy(giftCategory.id)
		.orderBy(giftCategory.sortOrder);
}

async function loadOrInitializeManagedGiftCategoryRows(wishlistId: string) {
	const database = getDb();
	let rows = await loadManagedGiftCategoryRows(database, wishlistId);
	if (rows.length === 0) {
		await ensureDefaultGiftCategories(wishlistId);
		rows = await loadManagedGiftCategoryRows(database, wishlistId);
	}
	return rows;
}

export async function getManagedGiftCategories(wishlistId: string): Promise<ManagedGiftCategory[]> {
	const rows = await loadOrInitializeManagedGiftCategoryRows(wishlistId);
	return rows
		.filter((row) => row.deletedAt === null)
		.map((row) => ({
			id: row.id,
			presetKey: row.presetKey as GiftCategoryPresetKey | null,
			customLabel: row.customLabel,
			color: row.color,
			sortOrder: row.sortOrder,
			usedCount: Number(row.usedCount),
		}));
}

export async function getManagedGiftCategorySettingsRows(
	wishlistId: string,
): Promise<ManagedGiftCategorySettingsRow[]> {
	const rows = await loadOrInitializeManagedGiftCategoryRows(wishlistId);
	return rows.map((row) => ({
		id: row.id,
		presetKey: row.presetKey as GiftCategoryPresetKey | null,
		customLabel: row.customLabel,
		color: row.color,
		sortOrder: row.sortOrder,
		usedCount: Number(row.usedCount),
		enabled: row.deletedAt === null,
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
				color: GIFT_CATEGORY_PRESET_BY_KEY.get(params.presetKey)!.color,
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

async function nextCustomCategoryColor(
	database: CategoryDatabase,
	wishlistId: string,
): Promise<string> {
	const rows = await database
		.select({ id: giftCategory.id })
		.from(giftCategory)
		.where(and(eq(giftCategory.wishlistId, wishlistId), isNull(giftCategory.presetKey)));
	return giftCategoryColorForIndex(rows.length);
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
			color: await nextCustomCategoryColor(database, params.wishlistId),
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

/**
 * Reconciles the complete settings snapshot under one wishlist lock. Retained rows are updated
 * in place; confirmed removals de-assign their gifts and soft-delete the category atomically.
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
		const presetColors = new Map(params.presetColors.map((item) => [item.key, item.color]));
		if (
			presetColors.size !== params.presetColors.length ||
			presetColors.size !== params.presetKeys.length ||
			params.presetKeys.some((key) => !presetColors.has(key))
		) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH);
		}

		const requestedIdSet = new Set(requestedIds);
		const requestedPresetSet = new Set(params.presetKeys);
		const removalIds = rows
			.filter(
				(row) =>
					row.deletedAt === null &&
					(row.presetKey === null
						? !requestedIdSet.has(row.id)
						: !requestedPresetSet.has(row.presetKey as GiftCategoryPresetKey)),
			)
			.map((row) => row.id);
		const confirmedRemovalIds = new Set(params.confirmedRemovalCategoryIds);
		if (
			confirmedRemovalIds.size !== params.confirmedRemovalCategoryIds.length ||
			confirmedRemovalIds.size !== removalIds.length ||
			removalIds.some((id) => !confirmedRemovalIds.has(id))
		) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH);
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
		const removeCategory = async (categoryId: string): Promise<void> => {
			await tx
				.update(gift)
				.set({ categoryId: null, updatedAt: now })
				.where(
					and(
						eq(gift.categoryId, categoryId),
						eq(gift.wishlistId, params.wishlistId),
						isNull(gift.deletedAt),
					),
				);
			await tx
				.update(giftCategory)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(
						eq(giftCategory.id, categoryId),
						eq(giftCategory.wishlistId, params.wishlistId),
						isNull(giftCategory.deletedAt),
					),
				);
		};
		const keptIds = new Set(requestedIds);
		for (const row of rows) {
			if (row.presetKey === null && row.deletedAt === null && !keptIds.has(row.id)) {
				await removeCategory(row.id);
			}
		}

		// Move every retained custom row out of the final-label namespace first. This permits
		// atomic swaps (A → B, B → A) without tripping the active normalized-label index.
		const occupiedTemporaryLabels = new Set(
			rows
				.filter((row) => row.deletedAt === null && row.customLabel !== null)
				.map((row) => normalizeGiftCategoryLabel(row.customLabel!)),
		);
		for (const [index, id] of requestedIds.entries()) {
			let suffix = 0;
			let temporaryLabel: string;
			do {
				temporaryLabel = `__category_reconcile_${index}_${suffix}_${id}`.slice(
					0,
					MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
				);
				suffix += 1;
			} while (occupiedTemporaryLabels.has(normalizeGiftCategoryLabel(temporaryLabel)));
			occupiedTemporaryLabels.add(normalizeGiftCategoryLabel(temporaryLabel));
			await tx
				.update(giftCategory)
				.set({ customLabel: temporaryLabel, updatedAt: now })
				.where(eq(giftCategory.id, id));
		}

		const orderedIds: string[] = [];
		for (const item of params.customCategories) {
			if (item.id === null) {
				const [created] = await tx
					.insert(giftCategory)
					.values({
						wishlistId: params.wishlistId,
						customLabel: item.label,
						color: item.color,
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
					.set({ customLabel: item.label, color: item.color, updatedAt: now })
					.where(eq(giftCategory.id, item.id));
				orderedIds.push(item.id);
			}
		}

		for (const preset of GIFT_CATEGORY_PRESETS) {
			const enabled = params.presetKeys.includes(preset.key);
			const row = rows.find((candidate) => candidate.presetKey === preset.key);
			if (!enabled) {
				if (row?.deletedAt === null) {
					await removeCategory(row.id);
				}
				continue;
			}
			if (row === undefined) {
				const [created] = await tx
					.insert(giftCategory)
					.values({
						wishlistId: params.wishlistId,
						presetKey: preset.key,
						color: presetColors.get(preset.key) ?? preset.color,
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
					.set({
						deletedAt: null,
						// Re-enabling a soft-deleted preset preserves its last customization. A newly
						// enabled preset has no row and starts from the curated definition above.
						color: presetColors.get(preset.key) ?? row.color,
						updatedAt: now,
					})
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

export function presetSortOrder(presetKey: GiftCategoryPresetKey): number {
	return GIFT_CATEGORY_PRESETS.findIndex((preset) => preset.key === presetKey);
}
