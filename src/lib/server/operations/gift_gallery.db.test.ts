import {
	DB_READY,
	createWishlistFixture,
	managerActor,
	readGift,
	recipientActor,
	removeFixtureRows,
	revisionsForGift,
	seedFixtureUsers,
} from './operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteObjectsBestEffort } from '$lib/server/storage/r2.js';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';
import { executeOperation } from './runner.js';
import { createGiftOperation, updateGiftOperation } from './gift_mutation_operations.js';
import { readWishlistGiftsOperation } from './gift_read_operations.js';
import { undoGiftRevisionOperation } from './gift_undo_operations.js';

const FIT = { fitMode: 'contain-padded' as const };
const FILL = { fitMode: 'cover-crop' as const };

function upload(name: string): GiftImage {
	return { imageUrl: null, imageKey: `gifts/gallery-${name}.webp`, imageMeta: FIT };
}

function link(name: string): GiftImage {
	return { imageUrl: `https://shop.example/${name}.jpg`, imageKey: null, imageMeta: FILL };
}

async function createGalleryGift(wishlistId: string, images: GiftImage[]): Promise<string> {
	const created = await executeOperation(recipientActor, createGiftOperation, {
		wishlistId,
		name: 'Gallery gift',
		images,
	});
	if (created.gift === undefined) {
		throw new Error('The gift was not created');
	}
	return created.gift.id;
}

function releasedKeys(): string[] {
	return vi
		.mocked(deleteObjectsBestEffort)
		.mock.calls.flatMap(([keys]) =>
			keys.filter((key): key is string => typeof key === 'string'),
		);
}

describe.skipIf(!DB_READY)('gift galleries [real DB]', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);
	beforeEach(() => {
		vi.mocked(deleteObjectsBestEffort).mockClear();
	});

	it('creates a gift with its ordered gallery and mirrors the first image as its cover', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const images = [upload('first'), link('second'), upload('third')];

		const giftId = await createGalleryGift(wishlistId, images);

		expect(await readGift(giftId)).toMatchObject({
			imageUrl: null,
			imageKey: 'gifts/gallery-first.webp',
			imageMeta: FIT,
			images,
		});
	});

	it('keeps the later images when a single-field edit replaces the cover', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGalleryGift(wishlistId, [
			upload('cover'),
			link('second'),
			upload('third'),
		]);

		await executeOperation(recipientActor, updateGiftOperation, {
			id: giftId,
			imageUrl: 'https://shop.example/new-cover.jpg',
			imageKey: null,
		});

		const updated = await readGift(giftId);
		expect(updated.imageUrl).toBe('https://shop.example/new-cover.jpg');
		expect(updated.images).toEqual([
			expect.objectContaining({
				imageUrl: 'https://shop.example/new-cover.jpg',
				imageKey: null,
			}),
			link('second'),
			upload('third'),
		]);
		expect(releasedKeys()).toEqual(['gifts/gallery-cover.webp']);
	});

	it('clears the whole gallery when a single-field edit removes the cover', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGalleryGift(wishlistId, [upload('only-cover'), upload('later')]);

		await executeOperation(recipientActor, updateGiftOperation, {
			id: giftId,
			imageUrl: null,
			imageKey: null,
		});

		expect(await readGift(giftId)).toMatchObject({
			imageKey: null,
			imageUrl: null,
			images: [],
		});
		expect(releasedKeys().sort()).toEqual([
			'gifts/gallery-later.webp',
			'gifts/gallery-only-cover.webp',
		]);
	});

	it('deletes only the uploads a reordered gallery drops', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const giftId = await createGalleryGift(wishlistId, [upload('a'), upload('b'), upload('c')]);

		await executeOperation(recipientActor, updateGiftOperation, {
			id: giftId,
			images: [upload('c'), upload('a')],
		});

		expect(await readGift(giftId)).toMatchObject({
			imageKey: 'gifts/gallery-c.webp',
			images: [upload('c'), upload('a')],
		});
		expect(releasedKeys()).toEqual(['gifts/gallery-b.webp']);
	});

	it('records galleries in revisions and undo restores the previous gallery', async () => {
		const { id: wishlistId } = await createWishlistFixture();
		const original = [link('one'), link('two'), link('three')];
		const giftId = await createGalleryGift(wishlistId, original);

		await executeOperation(managerActor, updateGiftOperation, {
			id: giftId,
			images: [link('three')],
		});
		const updateRevision = (await revisionsForGift(giftId)).find(
			(revision) => revision.before !== null,
		);
		expect(updateRevision).toMatchObject({
			before: { images: original },
			after: { images: [link('three')] },
		});

		await executeOperation(managerActor, undoGiftRevisionOperation, { giftId });

		expect(await readGift(giftId)).toMatchObject({
			imageUrl: 'https://shop.example/one.jpg',
			images: original,
		});
	});

	it('reads every gift with its gallery in order', async () => {
		const { id: wishlistId, shortId } = await createWishlistFixture();
		const galleryGiftId = await createGalleryGift(wishlistId, [
			link('first'),
			upload('second'),
			link('third'),
		]);
		const plainGiftId = await createGalleryGift(wishlistId, []);

		const { gifts } = await executeOperation(recipientActor, readWishlistGiftsOperation, {
			wishlistShortId: shortId,
		});

		const imagesById = new Map(gifts.map((row) => [row.id, row.images]));
		expect(imagesById.get(galleryGiftId)).toEqual([
			link('first'),
			upload('second'),
			link('third'),
		]);
		expect(imagesById.get(plainGiftId)).toEqual([]);
	});
});
