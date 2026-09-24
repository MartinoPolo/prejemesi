import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import {
	BulkCopyGiftsInputSchema,
	MAX_BULK_COPY_GIFTS,
	flattenGiftDescription,
	mapCopiedTaxonomy,
	portableGiftCopy,
	stageCopiedImage,
	compensateStagedImages,
} from './gift_bulk_copy.js';

function source(overrides: Record<string, unknown> = {}) {
	return {
		priorityLevelId: null,
		categoryPresetKey: null,
		categoryCustomLabel: null,
		...overrides,
	} as never;
}

describe('bulk gift copy requirements', () => {
	it('flattens the base description and appends without carrying append history', () => {
		expect(
			flattenGiftDescription('Original', [
				{ text: 'First clarification', addedAt: '2026-01-01T00:00:00.000Z' },
				{ text: 'Latest clarification', addedAt: '2026-01-02T00:00:00.000Z' },
			]),
		).toBe('Original\n\nFirst clarification\n\nLatest clarification');
		expect(flattenGiftDescription(null, [])).toBeNull();
	});

	it('copies only portable content under a new identity and flattens source history', () => {
		const copied = portableGiftCopy({
			source: source({
				id: 'source-id',
				name: 'Gift',
				description: 'Base',
				descriptionAppends: [{ text: 'Append', addedAt: '2026-01-01T00:00:00.000Z' }],
				links: [{ url: 'https://example.com' }],
				price: 10,
				priceMax: 20,
				currency: 'CZK',
				quantity: 2,
				imageUrl: null,
				imageKey: 'gifts/source.webp',
				imageMeta: { fit: 'cover-crop' },
				received: true,
				editedAfterShareAt: new Date(),
				preEditShareSnapshot: { name: 'old' },
				reservedCount: 1,
				likeCount: 3,
			}),
			destinationGiftId: 'destination-id',
			destinationImageKey: 'gifts/destination.webp',
			taxonomy: { priorityLevelId: 'destination-priority', categoryId: null },
		});
		expect(copied).toMatchObject({
			id: 'destination-id',
			description: 'Base\n\nAppend',
			imageKey: 'gifts/destination.webp',
			priorityLevelId: 'destination-priority',
			categoryId: null,
		});
		expect(Object.keys(copied)).not.toEqual(
			expect.arrayContaining([
				'received',
				'editedAfterShareAt',
				'preEditShareSnapshot',
				'descriptionAppends',
				'reservedCount',
				'likeCount',
			]),
		);
	});

	it('maps categories by preset or normalized custom label and falls back to uncategorized', () => {
		const destinations = [
			{ id: 'preset-destination', presetKey: 'books', customLabel: null },
			{ id: 'custom-destination', presetKey: null, customLabel: '  VýLeTy  ' },
		];
		expect(
			mapCopiedTaxonomy({
				source: source({ categoryPresetKey: 'books' }),
				sourcePriorityIdsByOrdinal: [],
				destinationPriorities: [],
				destinationCategories: destinations,
			}).categoryId,
		).toBe('preset-destination');
		expect(
			mapCopiedTaxonomy({
				source: source({ categoryCustomLabel: 'výlety' }),
				sourcePriorityIdsByOrdinal: [],
				destinationPriorities: [],
				destinationCategories: destinations,
			}).categoryId,
		).toBe('custom-destination');
		expect(
			mapCopiedTaxonomy({
				source: source({ categoryCustomLabel: 'Missing' }),
				sourcePriorityIdsByOrdinal: [],
				destinationPriorities: [],
				destinationCategories: destinations,
			}).categoryId,
		).toBeNull();
	});

	it('maps priority by ordinal and leaves a missing destination ordinal unset', () => {
		expect(
			mapCopiedTaxonomy({
				source: source({ priorityLevelId: 'source-second' }),
				sourcePriorityIdsByOrdinal: ['source-first', 'source-second'],
				destinationPriorities: [{ id: 'destination-first' }, { id: 'destination-second' }],
				destinationCategories: [],
			}).priorityLevelId,
		).toBe('destination-second');
		expect(
			mapCopiedTaxonomy({
				source: source({ priorityLevelId: 'source-second' }),
				sourcePriorityIdsByOrdinal: ['source-first', 'source-second'],
				destinationPriorities: [{ id: 'destination-first' }],
				destinationCategories: [],
			}).priorityLevelId,
		).toBeNull();
	});

	it('rejects a missing or failed uploaded-image copy before database work', async () => {
		const put = vi.fn(async () => true);
		await expect(
			stageCopiedImage('source', 'destination', {
				get: vi.fn(async () => null),
				put,
			}),
		).rejects.toThrow('Gift image copy failed');
		expect(put).not.toHaveBeenCalled();
		await expect(
			stageCopiedImage('source', 'destination', {
				get: vi.fn(async () => ({
					body: new ArrayBuffer(1),
					contentType: 'image/webp',
					etag: 'etag',
				})),
				put: vi.fn(async () => false),
			}),
		).rejects.toThrow('Gift image copy failed');
	});

	it('keeps the durable journal unresolved when staged-object cleanup fails', async () => {
		const resolve = vi.fn(async () => undefined);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await compensateStagedImages([{ key: 'gifts/copy.webp', journalId: 'journal' }], {
			remove: vi.fn(async () => {
				throw new Error('R2 unavailable');
			}),
			resolve,
		});
		expect(resolve).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('resolves the durable journal only after staged-object compensation succeeds', async () => {
		const remove = vi.fn(async () => undefined);
		const resolve = vi.fn(async () => undefined);
		await compensateStagedImages([{ key: 'gifts/copy.webp', journalId: 'journal' }], {
			remove,
			resolve,
		});
		expect(remove).toHaveBeenCalledWith('gifts/copy.webp');
		expect(resolve).toHaveBeenCalledWith('journal');
	});

	it('enforces the server-side batch bound', () => {
		const valid = {
			sourceWishlistId: 'source',
			destinationWishlistId: 'destination',
			giftIds: Array.from({ length: MAX_BULK_COPY_GIFTS }, (_, index) => `gift-${index}`),
		};
		expect(v.safeParse(BulkCopyGiftsInputSchema, valid).success).toBe(true);
		expect(
			v.safeParse(BulkCopyGiftsInputSchema, {
				...valid,
				giftIds: [...valid.giftIds, 'over-limit'],
			}).success,
		).toBe(false);
	});
});
