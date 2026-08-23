import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
	GiftIngestionManifestSchema,
	MAX_INGESTION_MANIFEST_BYTES,
	parseGiftIngestionManifest,
} from './manifest.js';

const validManifest = {
	schemaVersion: 1,
	manifestId: 'christmas-2026-001',
	wishlist: { shortId: 'family26', title: 'Christmas 2026', recipient: 'Rosie' },
	items: [
		{
			itemId: 'camera-a7c',
			sourceUrl: 'https://shop.example/products/camera',
			gift: {
				name: 'Camera',
				description: 'Silver',
				links: [{ url: 'https://shop.example/products/camera', label: 'Shop' }],
				price: 100,
				priceMax: 120,
				currency: 'EUR',
				imageUrl: 'https://images.example/camera.jpg',
				quantity: 2,
				priority: 'high',
			},
			provenance: {
				gatheredAt: '2026-08-08T10:00:00.000Z',
				fields: { name: 'json-ld', price: 'json-ld', imageUrl: 'open-graph' },
				imageSource: { url: 'https://shop.example/products/camera', method: 'open-graph' },
			},
		},
	],
};

describe('GiftIngestionManifestSchema', () => {
	it('accepts bounded strict ambiguities and rejects malformed or excessive entries', () => {
		const ambiguity = {
			itemId: 'camera-a7c',
			field: 'imageUrl',
			reason: 'Two exact images match.',
		};
		expect(
			v.parse(GiftIngestionManifestSchema, { ...validManifest, ambiguities: [ambiguity] }),
		).toMatchObject({ ambiguities: [ambiguity] });
		for (const ambiguities of [
			[{ ...ambiguity, reason: ' ' }],
			[{ ...ambiguity, reason: 'x'.repeat(301) }],
			[{ ...ambiguity, field: 'x'.repeat(101) }],
			[{ ...ambiguity, itemId: 'x'.repeat(129) }],
			[{ ...ambiguity, extra: true }],
			Array.from({ length: 51 }, () => ambiguity),
		]) {
			expect(
				v.safeParse(GiftIngestionManifestSchema, { ...validManifest, ambiguities }).success,
			).toBe(false);
		}
	});

	it('accepts only a bounded versioned add-only manifest with normalized gifts and provenance', () => {
		expect(
			v.parse(GiftIngestionManifestSchema, {
				...validManifest,
				wishlist: { ...validManifest.wishlist, shortId: '-zmeRy0r' },
			}),
		).toMatchObject({ wishlist: { shortId: '-zmeRy0r' } });
		expect(v.parse(GiftIngestionManifestSchema, validManifest)).toEqual(validManifest);

		const invalidCases = [
			{ ...validManifest, schemaVersion: 2 },
			{ ...validManifest, manifestId: ' spaces are unstable ' },
			{ ...validManifest, wishlist: { ...validManifest.wishlist, recipient: ' ' } },
			{ ...validManifest, items: [...validManifest.items, validManifest.items[0]] },
			{
				...validManifest,
				items: [{ ...validManifest.items[0], sourceUrl: 'http://shop.example/camera' }],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: { ...validManifest.items[0].gift, links: [] },
					},
				],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: {
							...validManifest.items[0].gift,
							links: [{ url: 'https://unrelated.example/product' }],
						},
					},
				],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: { ...validManifest.items[0].gift, quantity: 0 },
					},
				],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: { ...validManifest.items[0].gift, currency: 'GBP' },
					},
				],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: {
							...validManifest.items[0].gift,
							imageUrl: 'http://images.example/a.jpg',
						},
					},
				],
			},
			{
				...validManifest,
				items: [
					{
						...validManifest.items[0],
						gift: {
							...validManifest.items[0].gift,
							links: Array.from({ length: 11 }, (_, index) => ({
								url: `https://shop.example/product-${String(index)}`,
							})),
						},
					},
				],
			},
			{
				...validManifest,
				items: Array.from({ length: 201 }, (_, index) => ({
					...validManifest.items[0],
					itemId: `item-${String(index)}`,
				})),
			},
			{ ...validManifest, operation: 'delete' },
			{
				...validManifest,
				items: [{ ...validManifest.items[0], updateGiftId: 'gift-1' }],
			},
		];

		for (const manifest of invalidCases) {
			expect(v.safeParse(GiftIngestionManifestSchema, manifest).success).toBe(false);
		}
		expect(() =>
			parseGiftIngestionManifest(
				JSON.stringify(validManifest).padEnd(MAX_INGESTION_MANIFEST_BYTES + 1),
			),
		).toThrow(/too large/i);
	});
});
