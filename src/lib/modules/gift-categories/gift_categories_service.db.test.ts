import { randomUUID } from 'node:crypto';
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

const HAS_LOCAL_DB = isLocalDatabaseUrl(databaseUrl);

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: process.env.DATABASE_URL },
}));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift, giftCategory } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { saveGiftCategorySettings } from './gift_categories_service.js';

const PREFIX = `test-gift-category-color-${randomUUID()}-`;
const USER_ID = `${PREFIX}user`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const CATEGORY_ID = `${PREFIX}category`;
const GIFT_ID = `${PREFIX}gift`;
const INITIAL_COLOR = '#0369A1';
const UPDATED_COLOR = '#B91C1C';
const CATEGORY_LABEL = 'Sport';

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!HAS_LOCAL_DB) {
		return false;
	}
	try {
		const database = getDb();
		await database.transaction(async (tx) => {
			await tx.insert(user).values({
				id: `${PREFIX}probe-user`,
				name: 'Gift category probe',
				email: `${PREFIX}probe@example.com`,
			});
			await tx.insert(wishlist).values({
				id: `${PREFIX}probe-wishlist`,
				shortId: `${PREFIX}probe-short`,
				recipientUserId: `${PREFIX}probe-user`,
				recipientName: null,
				title: 'Gift category probe',
			});
			await tx.insert(giftCategory).values({
				id: `${PREFIX}probe-category`,
				wishlistId: `${PREFIX}probe-wishlist`,
				customLabel: 'Probe category',
				color: INITIAL_COLOR,
			});
			await tx.insert(gift).values({
				id: `${PREFIX}probe-gift`,
				wishlistId: `${PREFIX}probe-wishlist`,
				categoryId: `${PREFIX}probe-category`,
				name: 'Gift category probe',
			});
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

const editedAfterShareAt = new Date('2026-01-02T03:04:05.000Z');
const updatedAt = new Date('2026-01-03T04:05:06.000Z');
const preEditShareSnapshot = {
	name: 'Kolo',
	description: 'Původní popis',
	descriptionAppends: [],
	quantity: 1,
	price: 1200,
	priceMax: null,
	currency: 'CZK',
	imageUrl: null,
	imageKey: null,
	imageMeta: null,
	links: [{ url: 'https://example.com/kolo' }],
	priorityLevelId: null,
	categoryId: CATEGORY_ID,
};

describe.skipIf(!DB_READY)('gift category color persistence [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values({
			id: USER_ID,
			name: 'Gift category color user',
			email: `${PREFIX}user@example.com`,
		});
		await database.insert(wishlist).values({
			id: WISHLIST_ID,
			shortId: `${PREFIX}short`,
			recipientUserId: USER_ID,
			recipientName: null,
			title: 'Gift category color wishlist',
			status: 'active',
		});
		await database.insert(giftCategory).values({
			id: CATEGORY_ID,
			wishlistId: WISHLIST_ID,
			customLabel: CATEGORY_LABEL,
			color: INITIAL_COLOR,
			sortOrder: 0,
		});
		await database.insert(gift).values({
			id: GIFT_ID,
			wishlistId: WISHLIST_ID,
			categoryId: CATEGORY_ID,
			name: 'Kolo',
			description: 'Původní popis',
			links: [{ url: 'https://example.com/kolo' }],
			price: 1200,
			editedAfterShareAt,
			preEditShareSnapshot,
			updatedAt,
		});
	});

	afterAll(async () => {
		const database = getDb();
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(eq(user.id, USER_ID));
		await closeDb();
	});

	it('changes only the persisted category color and leaves the assigned gift untouched', async () => {
		const database = getDb();
		const [beforeCategory] = await database
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.id, CATEGORY_ID));
		const [beforeGift] = await database.select().from(gift).where(eq(gift.id, GIFT_ID));

		expect(beforeCategory?.color).toBe(INITIAL_COLOR);
		expect(beforeGift).toBeDefined();

		await saveGiftCategorySettings({
			wishlistId: WISHLIST_ID,
			customCategories: [{ id: CATEGORY_ID, label: CATEGORY_LABEL, color: UPDATED_COLOR }],
			presetKeys: [],
			presetColors: [],
			confirmedRemovalCategoryIds: [],
		});

		const [afterCategory] = await database
			.select()
			.from(giftCategory)
			.where(eq(giftCategory.id, CATEGORY_ID));
		const [afterGift] = await database.select().from(gift).where(eq(gift.id, GIFT_ID));

		expect(afterCategory).toMatchObject({
			id: CATEGORY_ID,
			customLabel: CATEGORY_LABEL,
			color: UPDATED_COLOR,
			deletedAt: null,
		});
		expect(afterGift?.categoryId).toBe(CATEGORY_ID);
		expect(afterGift).toEqual(beforeGift);
	});
});
