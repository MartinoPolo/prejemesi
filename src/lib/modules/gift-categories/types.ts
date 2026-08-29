import * as v from 'valibot';
import {
	GIFT_CATEGORY_PRESET_BY_KEY,
	GIFT_CATEGORY_PRESET_KEYS,
	type GiftCategoryPresetKey,
} from './presets.js';
import { GIFT_CATEGORY_COLOR_PATTERN } from './gift_category_colors.js';

export type { GiftCategoryPresetKey } from './presets.js';
export { GIFT_CATEGORY_PRESETS, GIFT_CATEGORY_PRESET_KEYS } from './presets.js';

export const MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH = 80;

export interface PublicGiftCategory {
	id: string;
	presetKey: GiftCategoryPresetKey | null;
	customLabel: string | null;
	color: string;
	sortOrder: number;
}

export interface ManagedGiftCategory extends PublicGiftCategory {
	usedCount: number;
}

export interface ManagedGiftCategorySettingsRow extends ManagedGiftCategory {
	enabled: boolean;
}

export interface GiftCategoryOption extends PublicGiftCategory {
	label: string;
	usedCount?: number;
}

export interface CategoryLabelMatch {
	kind: 'preset' | 'custom';
	presetKey?: GiftCategoryPresetKey;
	categoryId?: string;
}

export const GiftCategoryPresetKeySchema = v.picklist(GIFT_CATEGORY_PRESET_KEYS);
export const GiftCategoryColorSchema = v.pipe(
	v.string(),
	v.regex(GIFT_CATEGORY_COLOR_PATTERN, 'Category color must be a six-digit hex value'),
);

/** Complete category-settings snapshot committed as one transaction. */
export const SaveGiftCategorySettingsInputSchema = v.object({
	wishlistId: v.string(),
	customCategories: v.array(
		v.object({
			id: v.nullable(v.string()),
			label: v.pipe(
				v.string(),
				v.trim(),
				v.minLength(1),
				v.maxLength(MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH),
			),
			color: GiftCategoryColorSchema,
		}),
	),
	presetKeys: v.array(GiftCategoryPresetKeySchema),
	presetColors: v.array(
		v.object({ key: GiftCategoryPresetKeySchema, color: GiftCategoryColorSchema }),
	),
	confirmedRemovalCategoryIds: v.array(v.string()),
});

export type SaveGiftCategorySettingsInput = v.InferOutput<
	typeof SaveGiftCategorySettingsInputSchema
>;

export function normalizeGiftCategoryLabel(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('en-US')
		.replace(/[\s_-]+/g, ' ')
		.trim();
}

export function labelForGiftCategory(category: PublicGiftCategory, locale: 'cs' | 'en'): string {
	if (category.customLabel !== null) {
		return category.customLabel;
	}
	if (category.presetKey !== null) {
		return (
			GIFT_CATEGORY_PRESET_BY_KEY.get(category.presetKey)?.labels[locale] ??
			category.presetKey
		);
	}
	return '';
}

export function presetLabelsByNormalizedValue(): Map<string, GiftCategoryPresetKey> {
	const matches = new Map<string, GiftCategoryPresetKey>();
	for (const [presetKey, preset] of GIFT_CATEGORY_PRESET_BY_KEY) {
		matches.set(normalizeGiftCategoryLabel(preset.labels.cs), presetKey);
		matches.set(normalizeGiftCategoryLabel(preset.labels.en), presetKey);
	}
	return matches;
}

export function resolveCategoryLabel(
	label: string,
	activeCategories: readonly PublicGiftCategory[],
): CategoryLabelMatch | null {
	const normalized = normalizeGiftCategoryLabel(label);
	if (normalized === '') {
		return null;
	}
	for (const category of activeCategories) {
		if (
			category.customLabel !== null &&
			normalizeGiftCategoryLabel(category.customLabel) === normalized
		) {
			return { kind: 'custom', categoryId: category.id };
		}
		if (category.presetKey !== null) {
			const preset = GIFT_CATEGORY_PRESET_BY_KEY.get(category.presetKey);
			if (
				preset !== undefined &&
				(normalizeGiftCategoryLabel(preset.labels.cs) === normalized ||
					normalizeGiftCategoryLabel(preset.labels.en) === normalized)
			) {
				return { kind: 'preset', presetKey: category.presetKey, categoryId: category.id };
			}
		}
	}
	return null;
}
