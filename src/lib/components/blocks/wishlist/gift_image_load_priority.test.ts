import { describe, expect, it } from 'vitest';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_LOAD_PRIORITIES } from '$lib/components/derived/image-frame/image_load_priority.js';
import { ABOVE_THE_FOLD_GIFT_COUNT, giftImageLoadPriorities } from './gift_image_load_priority.js';

function gift(id: string, imageUrl: string | null): GiftByRole {
	return { id, imageUrl, imageKey: null } as GiftByRole;
}

describe('giftImageLoadPriorities', () => {
	it('loads the leading gifts eagerly and the first gift with an image at high priority', () => {
		const gifts = [
			gift('no-image', null),
			gift('first-image', 'https://example.test/a.jpg'),
			gift('second-image', 'https://example.test/b.jpg'),
		];

		expect(giftImageLoadPriorities(gifts)).toEqual(
			new Map([
				['no-image', IMAGE_LOAD_PRIORITIES.eager],
				['first-image', IMAGE_LOAD_PRIORITIES.high],
				['second-image', IMAGE_LOAD_PRIORITIES.eager],
			]),
		);
	});

	it('leaves gifts after the leading ones lazy', () => {
		const gifts = Array.from({ length: ABOVE_THE_FOLD_GIFT_COUNT + 2 }, (_, index) =>
			gift(`gift-${String(index)}`, 'https://example.test/a.jpg'),
		);
		const priorities = giftImageLoadPriorities(gifts);

		expect(priorities.size).toBe(ABOVE_THE_FOLD_GIFT_COUNT);
		expect(priorities.has(`gift-${String(ABOVE_THE_FOLD_GIFT_COUNT)}`)).toBe(false);
	});
});
