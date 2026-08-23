import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

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

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: process.env.DATABASE_URL },
}));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { appendGifts } from './gift_creation_service.js';

const PREFIX = `test-gift-creation-race-${Date.now()}-`;
const USER_ID = `${PREFIX}user`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const SEED_GIFT_ID = `${PREFIX}seed`;

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
				name: 'Gift creation probe',
				email: `${PREFIX}probe@example.com`,
			});
			await tx.insert(wishlist).values({
				id: `${PREFIX}probe-wishlist`,
				shortId: `${PREFIX}probe-short`,
				recipientUserId: `${PREFIX}probe-user`,
				recipientName: null,
				title: 'Gift creation probe',
			});
			await tx.insert(gift).values({
				id: `${PREFIX}probe-gift`,
				wishlistId: `${PREFIX}probe-wishlist`,
				name: 'Gift creation probe',
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

describe.skipIf(!DB_READY)('appendGifts atomicity and ordering [real DB]', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values({
			id: USER_ID,
			name: 'Gift creation race user',
			email: `${PREFIX}user@example.com`,
		});
		await database.insert(wishlist).values({
			id: WISHLIST_ID,
			shortId: `${PREFIX}short`,
			recipientUserId: USER_ID,
			recipientName: null,
			title: 'Gift creation race wishlist',
			status: 'active',
		});
		await database.insert(gift).values({
			id: SEED_GIFT_ID,
			wishlistId: WISHLIST_ID,
			name: `${PREFIX}seed gift`,
			sortOrder: 0,
		});
	});

	afterAll(async () => {
		const database = getDb();
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(eq(user.id, USER_ID));
		await closeDb();
	});

	it('serializes concurrent appends into unique contiguous sort orders', async () => {
		const names = [`${PREFIX}concurrent one`, `${PREFIX}concurrent two`];
		const results = await Promise.allSettled(
			names.map((name) =>
				appendGifts({
					wishlistId: WISHLIST_ID,
					actorId: USER_ID,
					gifts: [{ name }],
					notifyFollowers: false,
				}),
			),
		);

		expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
		const rows = await getDb()
			.select({ name: gift.name, sortOrder: gift.sortOrder })
			.from(gift)
			.where(
				and(
					eq(gift.wishlistId, WISHLIST_ID),
					isNull(gift.deletedAt),
					inArray(gift.name, [`${PREFIX}seed gift`, ...names]),
				),
			)
			.orderBy(asc(gift.sortOrder));

		expect(rows.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2]);
		expect(new Set(rows.map(({ sortOrder }) => sortOrder)).size).toBe(3);
		expect(
			rows
				.slice(1)
				.map(({ name }) => name)
				.sort(),
		).toEqual(names.toSorted());
	});

	it('rolls back every row when one gift violates a foreign key', async () => {
		const names = [`${PREFIX}rollback one`, `${PREFIX}rollback two`];

		await expect(
			appendGifts({
				wishlistId: WISHLIST_ID,
				actorId: USER_ID,
				notifyFollowers: false,
				gifts: [
					{ name: names[0] },
					{ name: names[1], priorityLevelId: `${PREFIX}missing-priority` },
				],
			}),
		).rejects.toBeDefined();

		const rows = await getDb()
			.select({ name: gift.name })
			.from(gift)
			.where(and(eq(gift.wishlistId, WISHLIST_ID), inArray(gift.name, names)));
		expect(rows).toEqual([]);
	});
});
