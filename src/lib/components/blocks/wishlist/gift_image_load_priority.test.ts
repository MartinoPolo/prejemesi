import { describe, expect, it } from 'vitest';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_LOAD_PRIORITIES } from '$lib/components/derived/image-frame/image_load_priority.js';
import { giftImageLoadPriorities } from './gift_image_load_priority.js';

const { eager, high } = IMAGE_LOAD_PRIORITIES;

function gift(
	id: string,
	image: { imageUrl?: string | null; imageKey?: string | null } = {},
): GiftByRole {
	return { id, imageUrl: image.imageUrl ?? null, imageKey: image.imageKey ?? null } as GiftByRole;
}

const withUrl = { imageUrl: 'https://example.test/a.jpg' };

describe('giftImageLoadPriorities', () => {
	it('loads the leading gifts eagerly and the first gift with an image at high priority', () => {
		const gifts = [
			gift('no-image'),
			gift('first-image', withUrl),
			gift('second-image', withUrl),
		];

		expect(giftImageLoadPriorities(gifts)).toEqual(
			new Map([
				['no-image', eager],
				['first-image', high],
				['second-image', eager],
			]),
		);
	});

	it('loads the first four gifts early and leaves the rest lazy', () => {
		const gifts = Array.from({ length: 6 }, (_, index) =>
			gift(`gift-${String(index)}`, withUrl),
		);

		expect(giftImageLoadPriorities(gifts)).toEqual(
			new Map([
				['gift-0', high],
				['gift-1', eager],
				['gift-2', eager],
				['gift-3', eager],
			]),
		);
	});

	it('counts an uploaded image key as an image and an empty URL as none', () => {
		const gifts = [
			gift('empty-url', { imageUrl: '' }),
			gift('uploaded', { imageKey: 'gifts/a.jpg' }),
		];

		expect(giftImageLoadPriorities(gifts)).toEqual(
			new Map([
				['empty-url', eager],
				['uploaded', high],
			]),
		);
	});

	it('gives no gift high priority when none of the leading gifts has an image', () => {
		const gifts = [gift('a'), gift('b'), gift('c'), gift('d'), gift('with-image', withUrl)];

		expect([...giftImageLoadPriorities(gifts).values()]).toEqual([eager, eager, eager, eager]);
	});
});
