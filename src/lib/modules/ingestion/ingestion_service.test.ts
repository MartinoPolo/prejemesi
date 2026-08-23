import { describe, expect, it, vi } from 'vitest';
import {
	canonicalGiftIngestionItemHash,
	IngestionWarningCollector,
	prepareGiftIngestionImages,
	processGiftIngestion,
	type GiftIngestionStore,
} from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';

const manifest: GiftIngestionManifest = {
	schemaVersion: 1,
	manifestId: 'batch-1',
	wishlist: { shortId: 'fixed-list', title: 'Christmas', recipient: 'Rosie' },
	items: [
		{
			itemId: 'item-1',
			sourceUrl: 'https://shop.example/camera?ref=agent',
			gift: {
				name: 'Camera',
				links: [{ url: 'https://shop.example/camera?ref=agent' }],
				currency: 'CZK',
				quantity: 1,
				priority: 'high',
			},
			provenance: { gatheredAt: '2026-08-08T10:00:00.000Z', fields: { name: 'json-ld' } },
		},
	],
};

function store(overrides: Partial<GiftIngestionStore> = {}): GiftIngestionStore {
	return {
		transaction: vi.fn(async (work) => work({})),
		lockTarget: vi.fn(async () => undefined),
		resolveTarget: vi.fn(async () => ({
			id: 'wishlist-db-id',
			shortId: 'fixed-list',
			title: 'Christmas',
			recipient: 'Rosie',
			status: 'active',
		})),
		findRun: vi.fn(async () => null),
		findItems: vi.fn(async () => []),
		findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		resolvePriorities: vi.fn(async () => ({
			high: 'priority-high',
			medium: 'priority-medium',
		})),
		appendGifts: vi.fn(async () => [{ id: 'gift-1' }]),
		insertRun: vi.fn(async () => 'run-1'),
		insertItems: vi.fn(async () => undefined),
		...overrides,
	};
}

const config = { targetShortId: 'fixed-list', actorId: 'machine-actor' };
const IMAGE_BODY = new Uint8Array(30).buffer;
const IMAGE_SHA256 = '0679246d6c4216de0daa08e5523fb2674db2b6599c3b72ff946b488a15290b62';
const imageManifest: GiftIngestionManifest = {
	...manifest,
	items: manifest.items.map((item) => ({
		...item,
		gift: { ...item.gift, imageUrl: 'https://cdn.example/camera.png' },
	})),
};

describe('processGiftIngestion', () => {
	it('prepares only validated creatable manifest items with exact short-lived presigned bindings', async () => {
		const database = store();
		const presign = vi.fn(async () => 'https://r2.example/signed');
		const prepared = await prepareGiftIngestionImages(imageManifest, {
			config,
			store: database,
			images: [
				{
					itemId: 'item-1',
					sha256: IMAGE_SHA256,
					contentType: 'image/png',
					byteLength: 30,
					width: 2,
					height: 3,
				},
			],
			presign,
		});
		expect(prepared).toEqual([
			expect.objectContaining({
				itemId: 'item-1',
				uploadUrl: 'https://r2.example/signed',
				key: expect.stringMatching(/^gifts\/ingestion\/wishlist-db-id\/batch-1\/item-1\//),
			}),
		]);
		expect(presign).toHaveBeenCalledWith(
			expect.objectContaining({
				objectKey: prepared[0]!.key,
				contentType: 'image/png',
				contentLength: 30,
			}),
		);
	});

	it('verifies staged image metadata before insertion and compensates every staged object when the transaction fails', async () => {
		const remove = vi.fn(async () => undefined);
		const recordOrphan = vi.fn(async () => undefined);
		const failing = store({
			transaction: vi.fn(async () => {
				throw new Error('database failed');
			}),
		});
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: failing,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => false),
					remove,
					recordOrphan,
				},
			}),
		).rejects.toThrow(/database/i);
		expect(remove).toHaveBeenCalledWith(key);
		expect(recordOrphan).not.toHaveBeenCalled();
	});

	it('rejects same-size and same-MIME wrong image bytes before insertion and cleans them', async () => {
		const database = store();
		const remove = vi.fn(async () => undefined);
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: database,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({
						body: new Uint8Array(30).fill(1).buffer,
						contentType: 'image/png',
					})),
					isReferenced: vi.fn(async () => false),
					remove,
					recordOrphan: vi.fn(async () => undefined),
				},
			}),
		).rejects.toThrow(/digest mismatch/i);
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(remove).toHaveBeenCalledWith(key);
	});

	it('reports failed reference verification without deleting the staged image', async () => {
		const remove = vi.fn(async () => undefined);
		const recordOrphan = vi.fn<
			(input: {
				key: string;
				reason: string;
				manifestId: string;
				itemId: string;
			}) => Promise<void>
		>(async () => undefined);
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: store({
					transaction: vi.fn(async () => {
						throw new Error('database failed');
					}),
				}),
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => {
						throw new Error(`reference database unavailable ${'x'.repeat(400)}`);
					}),
					remove,
					recordOrphan,
				},
			}),
		).rejects.toThrow(/database/i);

		expect(remove).not.toHaveBeenCalled();
		expect(recordOrphan).toHaveBeenCalledOnce();
		const report = recordOrphan.mock.calls[0]![0];
		expect(report).toMatchObject({ key, manifestId: 'batch-1', itemId: 'item-1' });
		expect(report.reason).toMatch(/^Reference verification failed:/);
		expect(report.reason.length).toBeLessThanOrEqual(300);
	});

	it('aborts before gift creation on missing/mismatched requested images and reports bounded cleanup failures', async () => {
		const database = store();
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		await expect(
			processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: database,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({
						body: new Uint8Array(29).buffer,
						contentType: 'image/png',
					})),
					isReferenced: vi.fn(async () => false),
					remove: vi.fn(async () => {
						throw new Error('r2 unavailable');
					}),
					recordOrphan: vi.fn(async () => undefined),
				},
			}),
		).rejects.toThrow(/verification/i);
		expect(database.appendGifts).not.toHaveBeenCalled();
	});
	it('keeps dry-run side-effect free and reports the resolved target and proposed items', async () => {
		const database = store();
		const result = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: database,
		});

		expect(result).toMatchObject({
			mode: 'dry-run',
			target: { shortId: 'fixed-list', title: 'Christmas', recipient: 'Rosie' },
			wouldCreate: [{ itemId: 'item-1', name: 'Camera' }],
			alreadyApplied: [],
			skipped: [],
			warnings: [],
			conflicts: [],
		});
		expect(database.transaction).not.toHaveBeenCalled();
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(database.insertRun).not.toHaveBeenCalled();
		expect(database.insertItems).not.toHaveBeenCalled();
	});

	it('reports ambiguities in dry-run and rejects apply and image preparation before side effects', async () => {
		const ambiguous: GiftIngestionManifest = {
			...manifest,
			ambiguities: [{ itemId: 'item-1', field: 'price', reason: 'Two prices match.' }],
		};
		const database = store();
		const dryRun = await processGiftIngestion(ambiguous, {
			apply: false,
			config,
			store: database,
		});
		expect(dryRun.ambiguities).toEqual(ambiguous.ambiguities);
		await expect(
			processGiftIngestion(ambiguous, { apply: true, config, store: database }),
		).rejects.toMatchObject({ code: 'ambiguity' });
		const presign = vi.fn(async () => 'https://r2.example/signed');
		await expect(
			prepareGiftIngestionImages(ambiguous, { config, store: database, images: [], presign }),
		).rejects.toMatchObject({ code: 'ambiguity' });
		expect(database.transaction).not.toHaveBeenCalled();
		expect(presign).not.toHaveBeenCalled();
	});

	it('reports a changed reused manifest id during dry-run before image preparation', async () => {
		const database = store({ findRun: vi.fn(async () => ({ manifestHash: 'different' })) });
		const result = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: database,
		});

		expect(result.conflicts).toEqual([
			{ manifestId: 'batch-1', reason: 'manifest-content-changed' },
		]);
		expect(database.transaction).not.toHaveBeenCalled();
	});

	it('rejects fixed-target, exact identity, and archived mismatches before mutation', async () => {
		for (const [changedManifest, target] of [
			[{ ...manifest, wishlist: { ...manifest.wishlist, shortId: 'other' } }, undefined],
			[{ ...manifest, wishlist: { ...manifest.wishlist, title: 'Other' } }, undefined],
			[manifest, { status: 'archived' }],
		] as const) {
			const database = store(
				target === undefined
					? {}
					: {
							resolveTarget: vi.fn(async () => ({
								id: 'wishlist-db-id',
								shortId: 'fixed-list',
								title: 'Christmas',
								recipient: 'Rosie',
								status: target.status,
							})),
						},
			);
			await expect(
				processGiftIngestion(changedManifest, { apply: true, config, store: database }),
			).rejects.toThrow(/target|identity|archived/i);
			expect(database.appendGifts).not.toHaveBeenCalled();
		}
	});

	it('appends through the shared transaction once and records gift audit atomically', async () => {
		const database = store();
		const result = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: database,
		});

		expect(database.transaction).toHaveBeenCalledOnce();
		expect(database.appendGifts).toHaveBeenCalledOnce();
		expect(database.appendGifts).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				wishlistId: 'wishlist-db-id',
				actorId: 'machine-actor',
				gifts: [
					expect.objectContaining({ name: 'Camera', priorityLevelId: 'priority-high' }),
				],
			}),
		);
		expect(database.insertItems).toHaveBeenCalledWith(expect.anything(), 'run-1', [
			expect.objectContaining({
				itemId: 'item-1',
				createdGiftId: 'gift-1',
				provenance: manifest.items[0]!.provenance,
			}),
		]);
		expect(result).toMatchObject({
			mode: 'apply',
			created: [{ itemId: 'item-1', giftId: 'gift-1' }],
		});
	});

	it('persists source-skipped identities and reuses their null audit identity safely', async () => {
		const firstStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: firstStore });
		const inserted = (firstStore.insertItems as ReturnType<typeof vi.fn>).mock.calls[0]![2] as {
			itemId: string;
			itemHash: string;
			createdGiftId: string | null;
		}[];
		expect(inserted).toEqual([
			expect.objectContaining({ itemId: 'item-1', createdGiftId: null }),
		]);

		const priorItem = inserted[0]!;
		const reuseStore = store({
			findItems: vi.fn(async () => [priorItem]),
			findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		});
		const reused = await processGiftIngestion(
			{ ...manifest, manifestId: 'batch-2' },
			{ apply: true, config, store: reuseStore },
		);
		expect(reused.skipped).toEqual([{ itemId: 'item-1', reason: 'existing-source-url' }]);
		expect(reused.alreadyApplied).toEqual([]);
		expect(reuseStore.insertItems).toHaveBeenCalledWith(expect.anything(), 'run-1', []);

		const changed = {
			...manifest,
			manifestId: 'batch-3',
			items: manifest.items.map((item) => ({
				...item,
				gift: { ...item.gift, name: 'Changed camera' },
			})),
		};
		const conflict = await processGiftIngestion(changed, {
			apply: false,
			config,
			store: reuseStore,
		});
		expect(conflict.conflicts).toEqual([{ itemId: 'item-1', reason: 'item-content-changed' }]);
	});

	it('bounds warning count and message length', () => {
		const collector = new IngestionWarningCollector();
		for (let index = 0; index < 60; index += 1) {
			collector.add(`${index}:${'x'.repeat(400)}`);
		}
		expect(collector.values()).toHaveLength(50);
		expect(collector.values().every((warning) => warning.length <= 300)).toBe(true);
	});

	it('collects bounded metadata and image provenance warnings and replays them', async () => {
		const warningManifest: GiftIngestionManifest = {
			...manifest,
			manifestId: 'batch-warnings',
			items: [
				{
					...manifest.items[0]!,
					gift: {
						...manifest.items[0]!.gift,
						description: 'Mirrorless camera',
						price: 12_000,
						imageUrl: 'https://cdn.example/camera.png',
					},
					provenance: {
						...manifest.items[0]!.provenance,
						fields: { name: 'json-ld' },
						imageSource: { url: 'https://cdn.example/other.png', method: 'open-graph' },
					},
				},
			],
		};
		const database = store();
		const dryRun = await processGiftIngestion(warningManifest, {
			apply: false,
			config,
			store: database,
		});
		expect(dryRun.warnings).toEqual([
			'Item item-1: add metadata provenance for description, price.',
			'Item item-1: gift image URL differs from its image provenance URL.',
		]);

		const applyStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(warningManifest, { apply: true, config, store: applyStore });
		const recorded = (applyStore.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		const replayStore = store({
			findRun: vi.fn(async () => recorded),
		});
		const replay = await processGiftIngestion(warningManifest, {
			apply: false,
			config,
			store: replayStore,
		});
		expect(replay.warnings).toEqual(dryRun.warnings);
	});

	it('warns for both missing sides of image provenance without rejecting the plan', async () => {
		const items: GiftIngestionManifest['items'] = [
			{
				...manifest.items[0]!,
				itemId: 'image-without-provenance',
				gift: {
					...manifest.items[0]!.gift,
					imageUrl: 'https://cdn.example/camera.png',
				},
			},
			{
				...manifest.items[0]!,
				itemId: 'provenance-without-image',
				sourceUrl: 'https://shop.example/book',
				gift: {
					...manifest.items[0]!.gift,
					name: 'Book',
					links: [{ url: 'https://shop.example/book' }],
				},
				provenance: {
					...manifest.items[0]!.provenance,
					imageSource: { url: 'https://cdn.example/book.png', method: 'json-ld' },
				},
			},
		];
		const result = await processGiftIngestion(
			{ ...manifest, manifestId: 'batch-image-warnings', items },
			{ apply: false, config, store: store() },
		);
		expect(result.wouldCreate).toHaveLength(2);
		expect(result.warnings).toEqual([
			'Item image-without-provenance: image URL is present but image provenance is missing.',
			'Item provenance-without-image: image provenance is present but the gift image URL is missing.',
		]);
	});

	it('records no-op applies and rejects a changed hash for an existing manifest id', async () => {
		const noOpStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: noOpStore });
		expect(noOpStore.insertRun).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				result: expect.objectContaining({ created: [], skipped: expect.any(Array) }),
			}),
		);

		const recorded = (noOpStore.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		(noOpStore.findRun as ReturnType<typeof vi.fn>).mockResolvedValue({
			manifestHash: recorded.manifestHash,
			result: recorded.result,
		});
		const replay = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: noOpStore,
		});
		expect(replay.skipped).toHaveLength(1);
		expect(noOpStore.insertRun).toHaveBeenCalledOnce();

		await expect(
			processGiftIngestion(
				{
					...manifest,
					items: manifest.items.map((item) => ({
						...item,
						gift: { ...item.gift, name: 'Changed camera' },
					})),
				},
				{ apply: true, config, store: noOpStore },
			),
		).rejects.toThrow(/idempotency conflict/i);
	});

	it('does not append when the target cannot be locked for apply', async () => {
		const database = store({
			lockTarget: vi.fn(async () => {
				throw new Error('target disappeared before lock');
			}),
		});

		await expect(
			processGiftIngestion(manifest, { apply: true, config, store: database }),
		).rejects.toThrow(/before lock/);
		expect(database.appendGifts).not.toHaveBeenCalled();
		expect(database.insertRun).not.toHaveBeenCalled();
	});

	it('cleans an unreferenced image made unnecessary by locked replanning but retains a referenced deterministic object', async () => {
		for (const referenced of [false, true]) {
			let sourceLookup = 0;
			const concurrentStore = store({
				findExistingSourceKeys: vi.fn(async () => {
					sourceLookup += 1;
					return sourceLookup === 1
						? new Set<string>()
						: new Set(['shop.example/camera?ref=agent']);
				}),
			});
			const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
			const remove = vi.fn(async () => undefined);
			const result = await processGiftIngestion(imageManifest, {
				apply: true,
				config,
				store: concurrentStore,
				preparedImages: [
					{
						wishlistId: 'wishlist-db-id',
						manifestId: 'batch-1',
						itemId: 'item-1',
						key,
						sha256: IMAGE_SHA256,
						contentType: 'image/png',
						byteLength: 30,
					},
				],
				imageStorage: {
					get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
					isReferenced: vi.fn(async () => referenced),
					remove,
					recordOrphan: vi.fn(async () => undefined),
				},
			});
			expect(result.skipped).toHaveLength(1);
			expect(remove).toHaveBeenCalledTimes(referenced ? 0 : 1);
		}
	});

	it('cleans a prepared byte-hash key when locked replanning finds the item already applied', async () => {
		let itemLookup = 0;
		const itemHash = await canonicalGiftIngestionItemHash(imageManifest.items[0]!);
		const database = store({
			findItems: vi.fn(async () => {
				itemLookup += 1;
				return itemLookup === 1
					? []
					: [{ itemId: 'item-1', itemHash, createdGiftId: 'gift-existing' }];
			}),
		});
		const key = `gifts/ingestion/wishlist-db-id/batch-1/item-1/${IMAGE_SHA256}.png`;
		const remove = vi.fn(async () => undefined);
		const result = await processGiftIngestion(imageManifest, {
			apply: true,
			config,
			store: database,
			preparedImages: [
				{
					wishlistId: 'wishlist-db-id',
					manifestId: 'batch-1',
					itemId: 'item-1',
					key,
					sha256: IMAGE_SHA256,
					contentType: 'image/png',
					byteLength: 30,
				},
			],
			imageStorage: {
				get: vi.fn(async () => ({ body: IMAGE_BODY, contentType: 'image/png' })),
				isReferenced: vi.fn(async () => false),
				remove,
				recordOrphan: vi.fn(async () => undefined),
			},
		});

		expect(result.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-existing' }]);
		expect(remove).toHaveBeenCalledWith(key);
	});

	it('persists prior-applied identities and restores them with newly created identities on replay', async () => {
		const mixedManifest: GiftIngestionManifest = {
			...manifest,
			manifestId: 'batch-mixed',
			items: [
				manifest.items[0]!,
				{
					...manifest.items[0]!,
					itemId: 'item-2',
					sourceUrl: 'https://shop.example/book',
					gift: {
						...manifest.items[0]!.gift,
						name: 'Book',
						links: [{ url: 'https://shop.example/book' }],
					},
				},
			],
		};
		const priorHash = await canonicalGiftIngestionItemHash(mixedManifest.items[0]!);
		const database = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: priorHash, createdGiftId: 'gift-prior' },
			]),
			appendGifts: vi.fn(async () => [{ id: 'gift-new' }]),
		});

		const first = await processGiftIngestion(mixedManifest, {
			apply: true,
			config,
			store: database,
		});
		expect(first.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-prior' }]);
		expect(first.created).toEqual([{ itemId: 'item-2', giftId: 'gift-new' }]);
		const recorded = (database.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		expect(recorded.result).toMatchObject({
			alreadyApplied: [{ itemId: 'item-1', giftId: 'gift-prior' }],
			created: [{ itemId: 'item-2', giftId: 'gift-new' }],
		});

		(database.findRun as ReturnType<typeof vi.fn>).mockResolvedValue({
			manifestHash: recorded.manifestHash,
			result: recorded.result,
		});
		const dryRun = await processGiftIngestion(mixedManifest, {
			apply: false,
			config,
			store: database,
		});
		const apply = await processGiftIngestion(mixedManifest, {
			apply: true,
			config,
			store: database,
		});
		const replayed = [
			{ itemId: 'item-1', giftId: 'gift-prior' },
			{ itemId: 'item-2', giftId: 'gift-new' },
		];
		expect(dryRun.alreadyApplied).toEqual(replayed);
		expect(apply.alreadyApplied).toEqual(replayed);
		expect(database.appendGifts).toHaveBeenCalledOnce();
	});

	it('restores a stored no-op replay despite later source-state changes in dry-run and apply', async () => {
		const first = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		await processGiftIngestion(manifest, { apply: true, config, store: first });
		const recorded = (first.insertRun as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
			manifestHash: string;
			result: Record<string, unknown>;
		};
		const replayStore = store({
			findRun: vi.fn(async () => ({
				manifestHash: recorded.manifestHash,
				result: recorded.result,
			})),
			findExistingSourceKeys: vi.fn(async () => new Set<string>()),
		});

		const dryRun = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: replayStore,
		});
		const apply = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: replayStore,
		});

		expect(dryRun.skipped).toEqual([{ itemId: 'item-1', reason: 'existing-source-url' }]);
		expect(apply.skipped).toEqual(dryRun.skipped);
		expect(dryRun.wouldCreate).toEqual([]);
		expect(apply.wouldCreate).toEqual([]);
		expect(replayStore.appendGifts).not.toHaveBeenCalled();
	});

	it('rejects duplicate canonical source URLs newly planned within one manifest', async () => {
		const duplicateManifest: GiftIngestionManifest = {
			...manifest,
			items: [
				manifest.items[0]!,
				{
					...manifest.items[0]!,
					itemId: 'item-2',
					sourceUrl: 'https://www.shop.example/camera?ref=agent#details',
				},
			],
		};

		const result = await processGiftIngestion(duplicateManifest, {
			apply: false,
			config,
			store: store(),
		});

		expect(result.wouldCreate).toEqual([{ itemId: 'item-1', name: 'Camera' }]);
		expect(result.skipped).toEqual([{ itemId: 'item-2', reason: 'existing-source-url' }]);
	});

	it('returns identical replays, rejects changed item IDs, and skips canonical source duplicates', async () => {
		const replayStore = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: 'MATCH', createdGiftId: 'gift-old' },
			]),
		});
		const itemHash = await canonicalGiftIngestionItemHash(manifest.items[0]!);
		(replayStore.findItems as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ itemId: 'item-1', itemHash, createdGiftId: 'gift-old' },
		]);
		const replay = await processGiftIngestion(manifest, {
			apply: true,
			config,
			store: replayStore,
		});
		expect(replay.alreadyApplied).toEqual([{ itemId: 'item-1', giftId: 'gift-old' }]);
		expect(replayStore.appendGifts).not.toHaveBeenCalled();

		const conflictStore = store({
			findItems: vi.fn(async () => [
				{ itemId: 'item-1', itemHash: 'changed', createdGiftId: 'gift-old' },
			]),
		});
		await expect(
			processGiftIngestion(manifest, { apply: true, config, store: conflictStore }),
		).rejects.toThrow(/conflict/i);
		expect(conflictStore.transaction).toHaveBeenCalledOnce();
		expect(conflictStore.appendGifts).not.toHaveBeenCalled();

		const duplicateStore = store({
			findExistingSourceKeys: vi.fn(async () => new Set(['shop.example/camera?ref=agent'])),
		});
		const duplicate = await processGiftIngestion(manifest, {
			apply: false,
			config,
			store: duplicateStore,
		});
		expect(duplicate.skipped).toEqual([
			expect.objectContaining({ itemId: 'item-1', reason: 'existing-source-url' }),
		]);
		expect(duplicate.wouldCreate).toEqual([]);
	});
});
