import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, asc, eq, inArray } from 'drizzle-orm';

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
import { wishlistFollower } from '$lib/server/db/follower.schema.js';
import { newGiftDigestState, notification } from '$lib/server/db/notification.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { coalesceNewGiftDigests, parseNewGiftDigestPayload } from './new_gift_digest.js';
import { DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TYPE } from './types.js';

const PREFIX = `test-new-gift-digest-race-${Date.now()}-`;
const RECIPIENT_ID = `${PREFIX}recipient`;
const ACTOR_ID = `${PREFIX}actor`;
const DISABLED_ID = `${PREFIX}disabled`;
const FOLLOWER_ID = `${PREFIX}follower`;
const USER_IDS = [RECIPIENT_ID, ACTOR_ID, DISABLED_ID, FOLLOWER_ID];
const WISHLIST_ID = `${PREFIX}wishlist`;
const NOW = new Date('2026-01-01T12:00:00.000Z');
const WISHLIST_CONTEXT = {
	id: WISHLIST_ID,
	shortId: `${PREFIX}short`,
	title: 'Digest race wishlist',
	recipientUserId: RECIPIENT_ID,
};

class ProbeRollback extends Error {}

async function isDbUsable(): Promise<boolean> {
	if (!HAS_LOCAL_DB) {
		return false;
	}
	try {
		await getDb().transaction(async (tx) => {
			await tx.insert(user).values({
				id: `${PREFIX}probe-user`,
				name: 'Digest probe',
				email: `${PREFIX}probe@example.com`,
			});
			await tx.insert(wishlist).values({
				id: `${PREFIX}probe-wishlist`,
				shortId: `${PREFIX}probe-short`,
				recipientUserId: `${PREFIX}probe-user`,
				recipientName: null,
				title: 'Digest probe',
			});
			await tx.select().from(newGiftDigestState).limit(1);
			await tx.select({ payload: notification.payload }).from(notification).limit(1);
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

async function addGifts(giftNames: string[], now: Date): Promise<void> {
	await getDb().transaction((tx) =>
		coalesceNewGiftDigests(tx, {
			wishlist: WISHLIST_CONTEXT,
			actorId: ACTOR_ID,
			giftNames,
			now,
		}),
	);
}

async function digestNotifications() {
	return getDb()
		.select({
			id: notification.id,
			userId: notification.userId,
			payload: notification.payload,
			visibleAt: notification.visibleAt,
		})
		.from(notification)
		.where(
			and(
				eq(notification.wishlistId, WISHLIST_ID),
				eq(notification.type, NOTIFICATION_TYPE.NEW_GIFT_ADDED),
			),
		)
		.orderBy(asc(notification.visibleAt), asc(notification.createdAt));
}

const DB_DESCRIBE = describe.skipIf(!DB_READY);
DB_DESCRIBE('new gift digest coalescing [real DB]', () => {
	beforeAll(async () => {
		const disabledPreferences = {
			...DEFAULT_NOTIFICATION_PREFERENCES,
			[NOTIFICATION_TYPE.NEW_GIFT_ADDED]: { email: false, inApp: false },
		};
		await getDb()
			.insert(user)
			.values([
				{
					id: RECIPIENT_ID,
					name: 'Digest recipient',
					email: `${PREFIX}recipient@example.com`,
				},
				{ id: ACTOR_ID, name: 'Digest actor', email: `${PREFIX}actor@example.com` },
				{
					id: DISABLED_ID,
					name: 'Digest disabled',
					email: `${PREFIX}disabled@example.com`,
					notificationPreferences: disabledPreferences,
				},
				{
					id: FOLLOWER_ID,
					name: 'Digest follower',
					email: `${PREFIX}follower@example.com`,
				},
			]);
		await getDb().insert(wishlist).values({
			id: WISHLIST_ID,
			shortId: WISHLIST_CONTEXT.shortId,
			recipientUserId: RECIPIENT_ID,
			recipientName: null,
			title: WISHLIST_CONTEXT.title,
			status: 'active',
		});
		await getDb()
			.insert(wishlistFollower)
			.values(USER_IDS.map((userId) => ({ wishlistId: WISHLIST_ID, userId })));
	});

	beforeEach(async () => {
		await getDb()
			.delete(newGiftDigestState)
			.where(inArray(newGiftDigestState.userId, USER_IDS));
		await getDb().delete(notification).where(inArray(notification.userId, USER_IDS));
	});

	afterAll(async () => {
		const database = getDb();
		await database
			.delete(newGiftDigestState)
			.where(inArray(newGiftDigestState.userId, USER_IDS));
		await database.delete(notification).where(inArray(notification.userId, USER_IDS));
		await database.delete(wishlistFollower).where(eq(wishlistFollower.wishlistId, WISHLIST_ID));
		await database.delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await database.delete(user).where(inArray(user.id, USER_IDS));
		await closeDb();
	});

	it('targets only opted-in active followers, excluding actor and linked recipient', async () => {
		await addGifts(['Camera'], NOW);

		const rows = await digestNotifications();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.userId).toBe(FOLLOWER_ID);
		expect(parseNewGiftDigestPayload(rows[0]!.payload)).toMatchObject({
			totalCount: 1,
			wishlists: [{ wishlistId: WISHLIST_ID, count: 1, namePreviews: ['Camera'] }],
		});
		const states = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(inArray(newGiftDigestState.userId, USER_IDS));
		expect(states).toHaveLength(1);
		expect(states[0]).toMatchObject({ userId: FOLLOWER_ID, activeNotificationId: rows[0]!.id });
	});

	it('coalesces an addition immediately before the window end', async () => {
		await addGifts(['Camera'], NOW);
		const [initialState] = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		const windowEndsAt = initialState!.windowEndsAt!;
		await addGifts(['Book'], new Date(windowEndsAt.getTime() - 1));

		const rows = await digestNotifications();
		expect(rows).toHaveLength(1);
		expect(parseNewGiftDigestPayload(rows[0]!.payload)).toMatchObject({
			totalCount: 2,
			wishlists: [{ wishlistId: WISHLIST_ID, count: 2, namePreviews: ['Camera', 'Book'] }],
		});
		const [state] = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		expect(state).toMatchObject({
			activeNotificationId: rows[0]!.id,
			windowStartedAt: NOW,
			windowEndsAt,
		});
	});

	it('creates a fresh digest exactly at the window end', async () => {
		await addGifts(['Camera'], NOW);
		const [initialState] = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		const windowEndsAt = initialState!.windowEndsAt!;
		await addGifts(['Book'], windowEndsAt);

		const rows = await digestNotifications();
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => parseNewGiftDigestPayload(row.payload)?.totalCount)).toEqual([
			1, 1,
		]);
		expect(parseNewGiftDigestPayload(rows[1]!.payload)?.wishlists[0]).toMatchObject({
			count: 1,
			namePreviews: ['Book'],
		});
		const [state] = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		expect(state).toMatchObject({
			activeNotificationId: rows[1]!.id,
			windowStartedAt: windowEndsAt,
		});
		expect(state!.windowEndsAt!.getTime()).toBe(windowEndsAt.getTime() + 24 * 60 * 60 * 1000);
	});

	it('coalesces concurrent additions into one hidden state window and notification', async () => {
		const giftNames = [`${PREFIX}camera`, `${PREFIX}book`];
		const results = await Promise.allSettled(giftNames.map((name) => addGifts([name], NOW)));
		expect(results.every((result) => result.status === 'fulfilled')).toBe(true);

		const rows = await digestNotifications();
		expect(rows).toHaveLength(1);
		expect(rows[0]!.visibleAt!.getTime()).toBeGreaterThan(NOW.getTime());
		const payload = parseNewGiftDigestPayload(rows[0]!.payload);
		expect(payload?.totalCount).toBe(2);
		expect(payload?.wishlists).toEqual([
			expect.objectContaining({
				wishlistId: WISHLIST_ID,
				count: 2,
				namePreviews: expect.arrayContaining(giftNames),
			}),
		]);
		const states = await getDb()
			.select()
			.from(newGiftDigestState)
			.where(eq(newGiftDigestState.userId, FOLLOWER_ID));
		expect(states).toHaveLength(1);
		expect(states[0]).toMatchObject({
			activeNotificationId: rows[0]!.id,
			windowStartedAt: NOW,
			windowEndsAt: rows[0]!.visibleAt,
		});
	});
});
