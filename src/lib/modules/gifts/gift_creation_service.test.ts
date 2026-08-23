import { describe, expect, it, vi } from 'vitest';
import {
	appendGifts,
	type GiftCreationError,
	type GiftCreationDatabase,
} from './gift_creation_service.js';
import { DEFAULT_IMAGE_METADATA } from '$lib/modules/images/types.js';

function fakeDatabase(results: unknown[][]) {
	const calls: { method: string; args: unknown[] }[] = [];
	let index = 0;
	const chain: Record<string | symbol, unknown> = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const result = results[index++] ?? [];
					return (resolve: (value: unknown) => void) => resolve(result);
				}
				return (...args: unknown[]) => {
					calls.push({ method: String(prop), args });
					return chain;
				};
			},
		},
	);
	const database = {
		transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(chain)),
	} as unknown as GiftCreationDatabase;
	return { database, calls };
}

const wishlist = {
	id: 'wl-1',
	shortId: 'family',
	title: 'Family',
	status: 'active',
	recipientUserId: 'recipient',
};

const giftInput = {
	name: 'Camera',
	description: 'Mirrorless',
	links: [{ url: 'https://shop.example/camera', label: 'Shop' }],
	price: 100,
	priceMax: 120,
	currency: 'EUR',
	imageUrl: 'https://img.example/camera.jpg',
	imageKey: 'gift/camera',
	imageMeta: { fitMode: 'contain-padded' as const },
	quantity: 2,
	priorityLevelId: 'priority-high',
};

describe('appendGifts', () => {
	it('locks the mutable wishlist and atomically appends all normalized fields in contiguous order', async () => {
		const created = [
			{ id: 'g-1', name: 'Camera', sortOrder: 4 },
			{ id: 'g-2', name: 'Book', sortOrder: 5 },
		];
		const { database, calls } = fakeDatabase([[wishlist], [{ maxSort: 3 }], created]);

		const result = await appendGifts(
			{
				wishlistId: wishlist.id,
				actorId: 'actor',
				gifts: [giftInput, { name: 'Book' }],
				notifyFollowers: false,
			},
			{ database },
		);

		expect(database.transaction).toHaveBeenCalledOnce();
		expect(calls.some((call) => call.method === 'for' && call.args[0] === 'update')).toBe(true);
		const inserted = calls.find(
			(call) => call.method === 'values' && Array.isArray(call.args[0]),
		)?.args[0] as Record<string, unknown>[];
		expect(inserted).toEqual([
			expect.objectContaining({ ...giftInput, wishlistId: 'wl-1', sortOrder: 4 }),
			expect.objectContaining({
				wishlistId: 'wl-1',
				name: 'Book',
				links: [],
				currency: 'CZK',
				quantity: 1,
				sortOrder: 5,
			}),
		]);
		expect(result).toEqual(created);
	});

	it('normalizes links and persists creation defaults in the real service boundary', async () => {
		const created = [{ id: 'g-defaults' }];
		const { database, calls } = fakeDatabase([[wishlist], [{ maxSort: -1 }], created]);
		const links = [
			{ url: ' javascript://example.com/%0Aalert(1)' },
			...Array.from({ length: 11 }, (_, index) => ({
				url: ` https://example.com/${index} `,
				label: ` Shop ${index} `,
			})),
		];

		await appendGifts(
			{
				wishlistId: wishlist.id,
				actorId: 'actor',
				notifyFollowers: false,
				gifts: [{ name: 'Defaults', links }],
			},
			{ database },
		);

		const insertedRows = calls.find(
			(call) => call.method === 'values' && Array.isArray(call.args[0]),
		)?.args[0];
		expect(insertedRows).toBeDefined();
		const [inserted] = insertedRows as Record<string, unknown>[];
		expect(inserted).toMatchObject({
			wishlistId: 'wl-1',
			name: 'Defaults',
			description: null,
			price: null,
			priceMax: null,
			currency: 'CZK',
			imageUrl: null,
			imageKey: null,
			imageMeta: null,
			quantity: 1,
			priorityLevelId: null,
			sortOrder: 0,
		});
		expect(inserted?.links).toEqual(
			Array.from({ length: 10 }, (_, index) => ({
				url: `https://example.com/${index}`,
				label: `Shop ${index}`,
			})),
		);
	});

	it('defaults image metadata for URL or key images and keeps imageless gifts null', async () => {
		const created = [{ id: 'g-url' }, { id: 'g-key' }, { id: 'g-none' }];
		const { database, calls } = fakeDatabase([[wishlist], [{ maxSort: -1 }], created, []]);

		await appendGifts(
			{
				wishlistId: wishlist.id,
				actorId: 'actor',
				notifyFollowers: false,
				gifts: [
					{ name: 'URL image', imageUrl: 'https://img.example/url.jpg' },
					{ name: 'Stored image', imageKey: 'gifts/stored.jpg' },
					{ name: 'No image', imageMeta: DEFAULT_IMAGE_METADATA },
				],
			},
			{ database },
		);

		const inserted = calls.find(
			(call) => call.method === 'values' && Array.isArray(call.args[0]),
		)?.args[0] as Record<string, unknown>[];
		expect(inserted.map(({ imageMeta }) => imageMeta)).toEqual([
			DEFAULT_IMAGE_METADATA,
			DEFAULT_IMAGE_METADATA,
			null,
		]);
	});

	it('rejects an archived wishlist before inserting gifts', async () => {
		const { database, calls } = fakeDatabase([[{ ...wishlist, status: 'archived' }]]);

		await expect(
			appendGifts(
				{
					wishlistId: wishlist.id,
					actorId: 'actor',
					gifts: [giftInput],
					notifyFollowers: false,
				},
				{ database },
			),
		).rejects.toEqual(
			expect.objectContaining<Partial<GiftCreationError>>({ code: 'wishlist-archived' }),
		);
		expect(calls.some((call) => call.method === 'insert')).toBe(false);
	});
});
