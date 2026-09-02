import * as m from '$lib/paraglide/messages.js';
import { GIFT_SORT_OPTIONS, type GiftSortOption } from '$lib/modules/gifts/types.js';

export const GIFT_SORT_LABELS = {
	ownerOrder: () => m.gift_sort_owner_order(),
	priority: () => m.gift_sort_priority(),
	priceAsc: () => m.gift_sort_price_asc(),
	priceDesc: () => m.gift_sort_price_desc(),
	name: () => m.gift_sort_name(),
	dateAdded: () => m.gift_sort_date_added(),
} satisfies Record<GiftSortOption, () => string>;

export const GIFT_SORT_KEYS = Object.values(GIFT_SORT_OPTIONS) as GiftSortOption[];
