import {
	categoryClaimFromLabel,
	labelForGiftCategory,
	occupiedGiftCategoryLabels,
	type GiftCategoryPresetKey,
	type ManagedGiftCategory,
	type PublicGiftCategory,
	type SaveGiftCategorySettingsInput,
} from '$lib/modules/gift-categories/types.js';

/** One category as the settings list edits it, in display order. */
export interface CategorySettingsRow {
	/** Stable identity across renders: the saved id, or a local id for an unsaved category. */
	key: string;
	id: string | null;
	/** Set while the saved row is a preset; a preset keeps following the locale until renamed. */
	presetKey: GiftCategoryPresetKey | null;
	label: string;
	color: string;
	stagedForRemoval: boolean;
}

export type CategorySettingsDraft = Required<
	Pick<SaveGiftCategorySettingsInput, 'categories' | 'confirmedRemovalCategoryIds'>
>;

export function categoryForRow(row: CategorySettingsRow): PublicGiftCategory {
	return {
		id: row.key,
		...categoryClaimFromLabel(row.presetKey, row.label),
		color: row.color,
		sortOrder: 0,
	};
}

export function rowsFromCategories(
	categories: readonly ManagedGiftCategory[],
	locale: 'cs' | 'en',
): CategorySettingsRow[] {
	return categories.map((category) => ({
		key: category.id,
		id: category.id,
		presetKey: category.customLabel === null ? category.presetKey : null,
		label: labelForGiftCategory(category, locale),
		color: category.color,
		stagedForRemoval: false,
	}));
}

/** Whether `label` on the row `key` (or a new row) would mean the same as another kept row. */
export function labelConflicts(
	rows: readonly CategorySettingsRow[],
	label: string,
	key: string | null,
): boolean {
	const presetKey = rows.find((candidate) => candidate.key === key)?.presetKey ?? null;
	const candidateLabels = occupiedGiftCategoryLabels(categoryClaimFromLabel(presetKey, label));
	return rows.some(
		(other) =>
			other.key !== key &&
			!other.stagedForRemoval &&
			occupiedGiftCategoryLabels(categoryClaimFromLabel(other.presetKey, other.label)).some(
				(occupied) => candidateLabels.includes(occupied),
			),
	);
}

export function categorySettingsDraft(rows: readonly CategorySettingsRow[]): CategorySettingsDraft {
	return {
		categories: rows
			.filter((row) => !row.stagedForRemoval)
			.map(({ id, label, color }) => ({ id, label: label.trim(), color })),
		confirmedRemovalCategoryIds: rows.flatMap((row) =>
			row.stagedForRemoval && row.id !== null ? [row.id] : [],
		),
	};
}
