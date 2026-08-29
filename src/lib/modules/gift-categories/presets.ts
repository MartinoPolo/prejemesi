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
	/** Curated content default; persisted per category and subsequently customizable. */
	color: string;
	labels: {
		cs: string;
		en: string;
	};
}

export const GIFT_CATEGORY_PRESETS: readonly GiftCategoryPresetDefinition[] = [
	{ key: 'games', color: '#7C3AED', labels: { cs: 'Hry', en: 'Games' } },
	{ key: 'toys', color: '#D97706', labels: { cs: 'Hračky', en: 'Toys' } },
	{ key: 'books', color: '#2563EB', labels: { cs: 'Knihy', en: 'Books' } },
	{ key: 'clothing', color: '#DB2777', labels: { cs: 'Oblečení', en: 'Clothing' } },
	{ key: 'electronics', color: '#0F766E', labels: { cs: 'Elektronika', en: 'Electronics' } },
	{ key: 'home', color: '#B45309', labels: { cs: 'Domácnost', en: 'Home' } },
	{ key: 'experiences', color: '#15803D', labels: { cs: 'Zážitky', en: 'Experiences' } },
	{ key: 'subscriptions', color: '#6D28D9', labels: { cs: 'Předplatné', en: 'Subscriptions' } },
	{ key: 'personal-care', color: '#BE185D', labels: { cs: 'Drogerie', en: 'Personal care' } },
] as const;

export const GIFT_CATEGORY_PRESET_BY_KEY = new Map(
	GIFT_CATEGORY_PRESETS.map((preset) => [preset.key, preset]),
);

export function isGiftCategoryPresetKey(value: string): value is GiftCategoryPresetKey {
	return (GIFT_CATEGORY_PRESET_KEYS as readonly string[]).includes(value);
}
