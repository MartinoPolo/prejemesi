import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
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
	categoryClaimFromLabel,
	normalizeGiftCategoryLabel,
	occupiedGiftCategoryLabels,
	type GiftCategoryClaim,
	type ManagedGiftCategory,
	type ManagedGiftCategorySettingsRow,
	type PublicGiftCategory,
	type SaveGiftCategorySettingsInput,
} from './types.js';
import type { GiftCreationTransaction } from '$lib/modules/gifts/gift_creation_service.js';
import type { GiftDraftInput } from '$lib/modules/gifts/types.js';
import type { RecordGiftRevisions } from '$lib/server/operations/gift_revisions.js';
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
		presetKey: row.presetKey,
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

async function insertDefaultGiftCategoriesWhenUnset(
	database: CategoryDatabase,
	wishlistId: string,
): Promise<void> {
	await lockWishlistCategoryStructure(database, wishlistId);
	const existing = await database
		.select({ id: giftCategory.id })
		.from(giftCategory)
		.where(eq(giftCategory.wishlistId, wishlistId))
		.limit(1);
	// Any row, including a soft-deleted one, proves that settings were explicitly saved.
	// This preserves an intentional all-disabled configuration.
	if (existing.length > 0) {
		return;
	}
	await database.insert(giftCategory).values(
		DEFAULT_ENABLED_GIFT_CATEGORY_PRESET_KEYS.map((key, sortOrder) => ({
			wishlistId,
			presetKey: key,
			color: GIFT_CATEGORY_PRESET_BY_KEY.get(key)!.color,
			sortOrder,
		})),
	);
}

async function ensureDefaultGiftCategories(wishlistId: string): Promise<void> {
	await getDb().transaction((tx) => insertDefaultGiftCategoriesWhenUnset(tx, wishlistId));
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
			presetKey: row.presetKey,
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
		presetKey: row.presetKey,
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

/** Rejects a category that would claim a label an active category of the wishlist already claims. */
async function assertNoLabelConflict(
	database: CategoryDatabase,
	wishlistId: string,
	category: GiftCategoryClaim,
): Promise<void> {
	const activeCategories = await getActiveGiftCategories(wishlistId, database);
	const occupiedLabels = new Set(activeCategories.flatMap(occupiedGiftCategoryLabels));
	if (occupiedGiftCategoryLabels(category).some((label) => occupiedLabels.has(label))) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT);
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
	if (row?.deletedAt === null) {
		return publicGiftCategory(row);
	}
	await assertNoLabelConflict(database, params.wishlistId, {
		presetKey: params.presetKey,
		customLabel: null,
	});
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
	params: { wishlistId: string; label: string; color?: string },
): Promise<PublicGiftCategory> {
	await assertNoLabelConflict(database, params.wishlistId, {
		presetKey: null,
		customLabel: params.label,
	});
	const [row] = await database
		.insert(giftCategory)
		.values({
			wishlistId: params.wishlistId,
			customLabel: params.label.trim(),
			color: params.color ?? (await nextCustomCategoryColor(database, params.wishlistId)),
			sortOrder: await nextSortOrder(database, params.wishlistId),
		})
		.returning();
	if (row === undefined) {
		error(500, SERVER_ERROR.FAILED_TO_CREATE_GIFT);
	}
	return publicGiftCategory(row);
}

/**
 * Adds one custom category after the enabled ones. A wishlist whose categories were never read
 * first receives the default set, so the new row does not read as an explicit all-disabled choice.
 */
export async function createCustomGiftCategory(
	database: CategoryDatabase,
	params: { wishlistId: string; label: string; color: string },
): Promise<PublicGiftCategory> {
	await insertDefaultGiftCategoriesWhenUnset(database, params.wishlistId);
	return createCustomGiftCategoryWithDatabase(database, params);
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

/** The caller's transaction, its gift revision recorder and the batch timestamp. */
interface GiftCategorySettingsWrite {
	transaction: CategoryDatabase;
	recordGiftRevisions: RecordGiftRevisions;
	now: Date;
}

type GiftCategorySettingsItem = NonNullable<SaveGiftCategorySettingsInput['categories']>[number];

/** A submitted category with the name it will claim once saved. */
interface FinalGiftCategory {
	id: string | null;
	label: string;
	color: string;
	claim: GiftCategoryClaim;
}

/**
 * Converts the superseded split shape into the ordered list: custom categories first, then the
 * enabled presets in curated order.
 */
function orderedCategoriesFromLegacyShape(
	params: SaveGiftCategorySettingsInput,
	activeCategories: readonly PublicGiftCategory[],
): GiftCategorySettingsItem[] {
	const presetKeys = params.presetKeys ?? [];
	const presetColorEntries = params.presetColors ?? [];
	const presetColors = new Map(presetColorEntries.map((item) => [item.key, item.color]));
	if (
		new Set(presetKeys).size !== presetKeys.length ||
		presetColors.size !== presetColorEntries.length ||
		presetColors.size !== presetKeys.length ||
		presetKeys.some((key) => !presetColors.has(key))
	) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH);
	}
	const enabledPresets = GIFT_CATEGORY_PRESETS.flatMap((preset) => {
		const color = presetColors.get(preset.key);
		if (color === undefined) {
			return [];
		}
		// Ids address only active rows, so an enabled preset without one, even a soft-deleted
		// preset, is saved as a new custom category under its Czech label.
		const id = activeCategories.find((category) => category.presetKey === preset.key)?.id;
		return [{ id: id ?? null, label: preset.labels.cs, color }];
	});
	return [...(params.customCategories ?? []), ...enabledPresets];
}

function resolveOrderedCategories(
	params: SaveGiftCategorySettingsInput,
	activeCategories: readonly PublicGiftCategory[],
): GiftCategorySettingsItem[] {
	const sendsLegacyShape =
		params.customCategories !== undefined ||
		params.presetKeys !== undefined ||
		params.presetColors !== undefined;
	if ((params.categories !== undefined) === sendsLegacyShape) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH);
	}
	return params.categories ?? orderedCategoriesFromLegacyShape(params, activeCategories);
}

/** Resolves the submitted list against the active categories, each kept at most once. */
function resolveFinalCategories(
	params: SaveGiftCategorySettingsInput,
	activeCategories: readonly PublicGiftCategory[],
): FinalGiftCategory[] {
	const activeCategoryById = new Map(activeCategories.map((category) => [category.id, category]));
	const finalCategories = resolveOrderedCategories(params, activeCategories).map((item) => {
		const presetKey =
			item.id === null ? null : (activeCategoryById.get(item.id)?.presetKey ?? null);
		return {
			id: item.id,
			label: item.label.trim(),
			color: item.color,
			claim: categoryClaimFromLabel(presetKey, item.label),
		};
	});
	const keptIds = finalCategories.flatMap((item) => item.id ?? []);
	if (
		new Set(keptIds).size !== keptIds.length ||
		keptIds.some((id) => !activeCategoryById.has(id))
	) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH);
	}
	return finalCategories;
}

/** Every used category being removed must be confirmed, and only categories being removed. */
async function validateRemovalConfirmation(
	transaction: CategoryDatabase,
	params: SaveGiftCategorySettingsInput,
	removalIds: readonly string[],
): Promise<void> {
	const usedRemovalRows =
		removalIds.length === 0
			? []
			: await transaction
					.select({ categoryId: gift.categoryId })
					.from(gift)
					.where(
						and(
							eq(gift.wishlistId, params.wishlistId),
							inArray(gift.categoryId, [...removalIds]),
							isNull(gift.deletedAt),
						),
					)
					.groupBy(gift.categoryId);
	const usedRemovalIds = new Set(usedRemovalRows.flatMap((row) => row.categoryId ?? []));
	const removalIdSet = new Set(removalIds);
	const confirmedRemovalIds = new Set(params.confirmedRemovalCategoryIds);
	if (
		confirmedRemovalIds.size !== params.confirmedRemovalCategoryIds.length ||
		params.confirmedRemovalCategoryIds.some((id) => !removalIdSet.has(id)) ||
		[...usedRemovalIds].some((id) => !confirmedRemovalIds.has(id))
	) {
		error(400, SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH);
	}
}

function assertDistinctFinalLabels(finalCategories: readonly FinalGiftCategory[]): void {
	const finalLabels = new Set<string>();
	for (const item of finalCategories) {
		const labels = occupiedGiftCategoryLabels(item.claim);
		if (labels.some((label) => finalLabels.has(label))) {
			error(400, SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT);
		}
		labels.forEach((label) => finalLabels.add(label));
	}
}

/** De-assigns each removed category's gifts with a revision, then soft-deletes the category. */
async function removeCategories(
	write: GiftCategorySettingsWrite,
	wishlistId: string,
	removalIds: readonly string[],
): Promise<void> {
	const { transaction, recordGiftRevisions, now } = write;
	for (const categoryId of removalIds) {
		const unassignedGifts = await transaction
			.update(gift)
			.set({ categoryId: null, updatedAt: now })
			.where(
				and(
					eq(gift.categoryId, categoryId),
					eq(gift.wishlistId, wishlistId),
					isNull(gift.deletedAt),
				),
			)
			.returning();
		await recordGiftRevisions(
			unassignedGifts.map((unassignedGift) => ({
				giftId: unassignedGift.id,
				wishlistId: unassignedGift.wishlistId,
				before: { ...unassignedGift, categoryId },
				after: unassignedGift,
			})),
		);
		await transaction
			.update(giftCategory)
			.set({ deletedAt: now, updatedAt: now })
			.where(
				and(
					eq(giftCategory.id, categoryId),
					eq(giftCategory.wishlistId, wishlistId),
					isNull(giftCategory.deletedAt),
				),
			);
	}
}

/**
 * Moves every kept row that ends with a custom label out of the final-label namespace first. This
 * permits atomic swaps (A → B, B → A) without tripping the active custom-label index.
 */
async function parkKeptRowsUnderTemporaryLabels(
	write: GiftCategorySettingsWrite,
	activeCategories: readonly PublicGiftCategory[],
	finalCategories: readonly FinalGiftCategory[],
): Promise<void> {
	const occupiedTemporaryLabels = new Set(
		activeCategories.flatMap((category) =>
			category.customLabel === null ? [] : [normalizeGiftCategoryLabel(category.customLabel)],
		),
	);
	for (const [index, item] of finalCategories.entries()) {
		if (item.id === null || item.claim.presetKey !== null) {
			continue;
		}
		let suffix = 0;
		let temporaryLabel: string;
		do {
			temporaryLabel = `__category_reconcile_${index}_${suffix}_${item.id}`.slice(
				0,
				MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
			);
			suffix += 1;
		} while (occupiedTemporaryLabels.has(normalizeGiftCategoryLabel(temporaryLabel)));
		occupiedTemporaryLabels.add(normalizeGiftCategoryLabel(temporaryLabel));
		await write.transaction
			.update(giftCategory)
			.set({ presetKey: null, customLabel: temporaryLabel, updatedAt: write.now })
			.where(eq(giftCategory.id, item.id));
	}
}

async function writeFinalCategories(
	write: GiftCategorySettingsWrite,
	wishlistId: string,
	finalCategories: readonly FinalGiftCategory[],
): Promise<void> {
	for (const [sortOrder, item] of finalCategories.entries()) {
		if (item.id === null) {
			await write.transaction.insert(giftCategory).values({
				wishlistId,
				customLabel: item.label,
				color: item.color,
				sortOrder,
			});
			continue;
		}
		await write.transaction
			.update(giftCategory)
			.set({
				...(item.claim.presetKey === null ? { customLabel: item.label } : {}),
				color: item.color,
				sortOrder,
				updatedAt: write.now,
			})
			.where(eq(giftCategory.id, item.id));
	}
}

/**
 * Reconciles the complete ordered category list under one wishlist lock. Kept rows are updated in
 * place; renaming a preset turns it into a custom category with the same id, color and gifts. Used
 * removals require confirmation before their gifts are de-assigned and the category is
 * soft-deleted atomically.
 */
export async function saveGiftCategorySettings(
	params: SaveGiftCategorySettingsInput,
	write: GiftCategorySettingsWrite,
): Promise<void> {
	const { transaction } = write;
	await lockWishlistCategoryStructure(transaction, params.wishlistId);
	const rows = await transaction
		.select()
		.from(giftCategory)
		.where(eq(giftCategory.wishlistId, params.wishlistId))
		.for('update');
	const activeCategories = rows.filter((row) => row.deletedAt === null).map(publicGiftCategory);
	const finalCategories = resolveFinalCategories(params, activeCategories);
	const keptIds = new Set(finalCategories.flatMap((item) => item.id ?? []));
	const removalIds = activeCategories
		.filter((category) => !keptIds.has(category.id))
		.map((category) => category.id);

	await validateRemovalConfirmation(transaction, params, removalIds);
	assertDistinctFinalLabels(finalCategories);
	await removeCategories(write, params.wishlistId, removalIds);
	await parkKeptRowsUnderTemporaryLabels(write, activeCategories, finalCategories);
	await writeFinalCategories(write, params.wishlistId, finalCategories);
}

export function presetSortOrder(presetKey: GiftCategoryPresetKey): number {
	return GIFT_CATEGORY_PRESETS.findIndex((preset) => preset.key === presetKey);
}
