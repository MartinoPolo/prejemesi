export const GIFT_CATEGORY_PRESET_KEYS = [
	'games',
	'toys',
	'books',
	'clothing',
	'electronics',
	'home',
	'experiences',
	'subscriptions',
	'personal-care',
] as const;

export type GiftCategoryPresetKey = (typeof GIFT_CATEGORY_PRESET_KEYS)[number];

export interface GiftCategoryPresetDefinition {
	key: GiftCategoryPresetKey;
	labels: {
		cs: string;
		en: string;
	};
}

export const GIFT_CATEGORY_PRESETS: readonly GiftCategoryPresetDefinition[] = [
	{ key: 'games', labels: { cs: 'Hry', en: 'Games' } },
	{ key: 'toys', labels: { cs: 'Hračky', en: 'Toys' } },
	{ key: 'books', labels: { cs: 'Knihy', en: 'Books' } },
	{ key: 'clothing', labels: { cs: 'Oblečení', en: 'Clothing' } },
	{ key: 'electronics', labels: { cs: 'Elektronika', en: 'Electronics' } },
	{ key: 'home', labels: { cs: 'Domácnost', en: 'Home' } },
	{ key: 'experiences', labels: { cs: 'Zážitky', en: 'Experiences' } },
	{ key: 'subscriptions', labels: { cs: 'Předplatné', en: 'Subscriptions' } },
	{ key: 'personal-care', labels: { cs: 'Drogerie', en: 'Personal care' } },
] as const;

export const GIFT_CATEGORY_PRESET_BY_KEY = new Map(
	GIFT_CATEGORY_PRESETS.map((preset) => [preset.key, preset]),
);

export function isGiftCategoryPresetKey(value: string): value is GiftCategoryPresetKey {
	return (GIFT_CATEGORY_PRESET_KEYS as readonly string[]).includes(value);
}
