import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { giftIngestionItem, giftIngestionRun } from '$lib/server/db/ingestion.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { drizzleGiftIngestionStore } from './ingestion_store.js';
import { processGiftIngestion } from './ingestion_service.js';
import type { GiftIngestionManifest } from './manifest.js';

const PREFIX = `test-ingestion-race-${Date.now()}-`;
const USER_ID = `${PREFIX}user`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const SHORT_ID = `${PREFIX}short`;
const MANIFEST_ID = `${PREFIX}manifest`;
const ITEM_ID = `${PREFIX}item`;

const manifest: GiftIngestionManifest = {
	schemaVersion: 1,
	manifestId: MANIFEST_ID,
	wishlist: { shortId: SHORT_ID, title: 'Ingestion race', recipient: 'Race user' },
	items: [
		{
			itemId: ITEM_ID,
			sourceUrl: `https://shop.example/${PREFIX}gift`,
			gift: {
				name: `${PREFIX}gift`,
				links: [{ url: `https://shop.example/${PREFIX}gift` }],
				currency: 'CZK',
				quantity: 1,
				priority: 'high',
			},
			provenance: {
				gatheredAt: '2026-08-08T10:00:00.000Z',
				fields: { name: 'json-ld' },
			},
		},
	],
};

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (tx) => {
			await tx
				.select({ provenance: giftIngestionItem.provenance })
				.from(giftIngestionItem)
				.limit(1);
			throw new ProbeRollback();
		});
		return true;
	} catch (caught) {
		if (caught instanceof ProbeRollback) {
			return true;
		}
		await closeDb().catch(() => undefined);
		return false;
	}
}

const DB_READY = await isDbUsable();

describe.skipIf(!DB_READY)('gift ingestion idempotency race [real DB]', () => {
	beforeAll(async () => {
		await getDb()
			.insert(user)
			.values({
				id: USER_ID,
				name: 'Race user',
				email: `${PREFIX}user@example.com`,
			});
		await getDb().insert(wishlist).values({
			id: WISHLIST_ID,
			shortId: SHORT_ID,
			recipientUserId: USER_ID,
			recipientName: null,
			title: 'Ingestion race',
			status: 'active',
		});
	});

	afterAll(async () => {
		const database = getDb();
		await database.delete(giftIngestionItem).where(eq(giftIngestionItem.itemId, ITEM_ID));
		await database.delete(giftIngestionRun).where(eq(giftIngestionRun.manifestId, MANIFEST_ID));
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(eq(user.id, USER_ID));
		await closeDb();
	});

	it('commits exactly one gift, run, and item audit for concurrent identical applies', async () => {
		const options = {
			apply: true,
			config: { targetShortId: SHORT_ID, actorId: USER_ID },
			store: drizzleGiftIngestionStore,
		} as const;
		const results = await Promise.allSettled([
			processGiftIngestion(manifest, options),
			processGiftIngestion(manifest, options),
		]);
		expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

		const [gifts, runs, items] = await Promise.all([
			getDb().select().from(gift).where(eq(gift.wishlistId, WISHLIST_ID)),
			getDb()
				.select()
				.from(giftIngestionRun)
				.where(eq(giftIngestionRun.manifestId, MANIFEST_ID)),
			getDb().select().from(giftIngestionItem).where(eq(giftIngestionItem.itemId, ITEM_ID)),
		]);
		expect(gifts).toHaveLength(1);
		expect(runs).toHaveLength(1);
		expect(items).toHaveLength(1);
		expect(items[0]?.provenance).toEqual(manifest.items[0]?.provenance);
	});
});
