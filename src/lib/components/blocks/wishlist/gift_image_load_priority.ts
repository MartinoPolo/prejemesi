import {
	IMAGE_LOAD_PRIORITIES,
	type ImageLoadPriority,
} from '$lib/components/derived/image-frame/index.js';
import { resolveGiftImageUrl } from '$lib/modules/images/public_url.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';

/** Leading gifts that load eagerly: a phone shows about the first row below the hero. */
const ABOVE_THE_FOLD_GIFT_COUNT = 4;

/**
 * Load priority per gift id for gifts in display order: the leading gifts load eagerly so their
 * requests do not wait for lazy-load intersection checks, and the first of them with an image,
 * the likely LCP element, at high fetch priority. Gifts further down stay lazy (absent).
 */
export function giftImageLoadPriorities(
	giftsInDisplayOrder: readonly GiftByRole[],
): ReadonlyMap<string, ImageLoadPriority> {
	const priorities = new Map<string, ImageLoadPriority>();
	let highPriorityAssigned = false;
	for (const gift of giftsInDisplayOrder.slice(0, ABOVE_THE_FOLD_GIFT_COUNT)) {
		const hasImage = resolveGiftImageUrl(gift.imageUrl, gift.imageKey) !== null;
		if (hasImage && !highPriorityAssigned) {
			priorities.set(gift.id, IMAGE_LOAD_PRIORITIES.high);
			highPriorityAssigned = true;
		} else {
			priorities.set(gift.id, IMAGE_LOAD_PRIORITIES.eager);
		}
	}
	return priorities;
}
