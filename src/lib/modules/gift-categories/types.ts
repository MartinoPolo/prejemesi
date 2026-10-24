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

const CustomGiftCategoryLabelSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1),
	v.maxLength(MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH),
);

const GiftCategorySettingsItemSchema = v.object({
	id: v.nullable(v.string()),
	label: CustomGiftCategoryLabelSchema,
	color: GiftCategoryColorSchema,
});

function deprecatedInFavourOfCategories<TSchema extends v.GenericSchema>(schema: TSchema) {
	return v.optional(
		v.pipe(schema, v.description('Deprecated: send the ordered `categories` list instead.')),
	);
}

/**
 * Complete category-settings snapshot committed as one transaction. `customCategories`,
 * `presetKeys` and `presetColors` are the superseded split shape, still accepted from agents and
 * stored change proposals.
 */
export const SaveGiftCategorySettingsInputSchema = v.object({
	wishlistId: v.string(),
	categories: v.optional(
		v.pipe(
			v.array(GiftCategorySettingsItemSchema),
			v.description(
				'The final ordered category list; array order is the display order. An `id` keeps that existing category (relabelled and recolored as given), `null` creates one, and an existing category left out is removed.',
			),
		),
	),
	confirmedRemovalCategoryIds: v.array(v.string()),
	customCategories: deprecatedInFavourOfCategories(v.array(GiftCategorySettingsItemSchema)),
	presetKeys: deprecatedInFavourOfCategories(v.array(GiftCategoryPresetKeySchema)),
	presetColors: deprecatedInFavourOfCategories(
		v.array(v.object({ key: GiftCategoryPresetKeySchema, color: GiftCategoryColorSchema })),
	),
});

export type SaveGiftCategorySettingsInput = v.InferOutput<
	typeof SaveGiftCategorySettingsInputSchema
>;

/** A custom category created from a category picker, added at once to the gifts it acted on. */
export const CreateGiftCategoryInputSchema = v.strictObject({
	wishlistId: v.string(),
	label: CustomGiftCategoryLabelSchema,
	color: GiftCategoryColorSchema,
	giftIds: v.array(v.string()),
});

export type CreateGiftCategoryInput = v.InferOutput<typeof CreateGiftCategoryInputSchema>;

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

/** How a category is named: by a preset that follows the viewer's locale, or by its own label. */
export interface GiftCategoryClaim {
	presetKey: GiftCategoryPresetKey | null;
	customLabel: string | null;
}

/**
 * The normalized labels a category claims: its custom label, or both locale labels of an
 * unrenamed preset, which follows the viewer's locale.
 */
export function occupiedGiftCategoryLabels(category: GiftCategoryClaim): string[] {
	if (category.customLabel !== null) {
		return [normalizeGiftCategoryLabel(category.customLabel)];
	}
	const preset =
		category.presetKey === null
			? undefined
			: GIFT_CATEGORY_PRESET_BY_KEY.get(category.presetKey);
	return preset === undefined
		? []
		: [
				normalizeGiftCategoryLabel(preset.labels.cs),
				normalizeGiftCategoryLabel(preset.labels.en),
			];
}

/** A preset submitted under one of its own labels, in either locale, stays a preset. */
export function keepsPresetLabel(presetKey: GiftCategoryPresetKey | null, label: string): boolean {
	const preset = presetKey === null ? undefined : GIFT_CATEGORY_PRESET_BY_KEY.get(presetKey);
	const trimmedLabel = label.trim();
	return (
		preset !== undefined &&
		(trimmedLabel === preset.labels.cs || trimmedLabel === preset.labels.en)
	);
}

/**
 * How a category saved as `presetKey` is named once submitted under `label`: still the preset, or
 * a custom category carrying the trimmed label.
 */
export function categoryClaimFromLabel(
	presetKey: GiftCategoryPresetKey | null,
	label: string,
): GiftCategoryClaim {
	return keepsPresetLabel(presetKey, label)
		? { presetKey, customLabel: null }
		: { presetKey: null, customLabel: label.trim() };
}

export function resolveCategoryLabel(
	label: string,
	activeCategories: readonly PublicGiftCategory[],
): CategoryLabelMatch | null {
	const normalized = normalizeGiftCategoryLabel(label);
	if (normalized === '') {
		return null;
	}
	const category = activeCategories.find((candidate) =>
		occupiedGiftCategoryLabels(candidate).includes(normalized),
	);
	if (category === undefined) {
		return null;
	}
	return category.presetKey === null
		? { kind: 'custom', categoryId: category.id }
		: { kind: 'preset', presetKey: category.presetKey, categoryId: category.id };
}
