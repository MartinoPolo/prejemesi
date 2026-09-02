import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';

function isLocalDatabaseUrl(value: string): boolean {
	try {
		return ['localhost', '127.0.0.1', '::1'].includes(new URL(value).hostname.toLowerCase());
	} catch {
		return false;
	}
}

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(() => {
		throw new Error('no request context');
	}),
}));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
vi.mock('$lib/server/remote.js', async () => {
	const v = await import('valibot');
	const wrapped = (handler: (...args: unknown[]) => unknown) => {
		(handler as unknown as { __: object }).__ = {};
		return handler;
	};
	return {
		guardedQueryWithArgs: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
		guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => wrapped(handler)),
		guardedCommand: vi.fn(
			(schema: Parameters<typeof v.parse>[0], handler: (...args: unknown[]) => unknown) =>
				wrapped((auth: unknown, input: unknown) => handler(auth, v.parse(schema, input))),
		),
	};
});

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { gift, giftLike } from '$lib/server/db/gift.schema.js';
import { getUserLikesForWishlistScoped } from './likes.remote.js';

const PREFIX = `test-scoped-likes-${Date.now()}-`;
const ACTOR_ID = `${PREFIX}actor`;
const OTHER_USER_ID = `${PREFIX}other-user`;
const TARGET_WISHLIST_ID = `${PREFIX}target-wishlist`;
const OTHER_WISHLIST_ID = `${PREFIX}other-wishlist`;
const ACTIVE_TARGET_GIFT_ID = `${PREFIX}active-target-gift`;
const DELETED_TARGET_GIFT_ID = `${PREFIX}deleted-target-gift`;
const SOFT_DELETED_LIKE_GIFT_ID = `${PREFIX}soft-deleted-like-gift`;
const OTHER_WISHLIST_GIFT_ID = `${PREFIX}other-wishlist-gift`;

type GetLikesHandler = (
	auth: { user: { id: string } },
	input: { wishlistId: string },
) => Promise<string[]>;
const callGetLikes = getUserLikesForWishlistScoped as unknown as GetLikesHandler;
const DB_READY = isLocalDatabaseUrl(databaseUrl);

describe.skipIf(!DB_READY)('getUserLikesForWishlistScoped database scope', () => {
	beforeAll(async () => {
		const database = getDb();
		await database.insert(user).values([
			{
				id: ACTOR_ID,
				name: 'Actor',
				email: `${ACTOR_ID}@example.invalid`,
				emailVerified: true,
			},
			{
				id: OTHER_USER_ID,
				name: 'Other user',
				email: `${OTHER_USER_ID}@example.invalid`,
				emailVerified: true,
			},
		]);
		await database.insert(wishlist).values([
			{
				id: TARGET_WISHLIST_ID,
				shortId: `${PREFIX}target`,
				recipientUserId: ACTOR_ID,
				title: 'Target wishlist',
			},
			{
				id: OTHER_WISHLIST_ID,
				shortId: `${PREFIX}other`,
				recipientUserId: OTHER_USER_ID,
				title: 'Other wishlist',
			},
		]);
		await database.insert(gift).values([
			{ id: ACTIVE_TARGET_GIFT_ID, wishlistId: TARGET_WISHLIST_ID, name: 'Active target' },
			{
				id: DELETED_TARGET_GIFT_ID,
				wishlistId: TARGET_WISHLIST_ID,
				name: 'Deleted target',
				deletedAt: new Date(),
			},
			{
				id: SOFT_DELETED_LIKE_GIFT_ID,
				wishlistId: TARGET_WISHLIST_ID,
				name: 'Soft-deleted like',
			},
			{
				id: OTHER_WISHLIST_GIFT_ID,
				wishlistId: OTHER_WISHLIST_ID,
				name: 'Other wishlist gift',
			},
		]);
		await database.insert(giftLike).values([
			{ id: `${PREFIX}active-like`, giftId: ACTIVE_TARGET_GIFT_ID, userId: ACTOR_ID },
			{
				id: `${PREFIX}other-user-like`,
				giftId: ACTIVE_TARGET_GIFT_ID,
				userId: OTHER_USER_ID,
			},
			{ id: `${PREFIX}deleted-gift-like`, giftId: DELETED_TARGET_GIFT_ID, userId: ACTOR_ID },
			{
				id: `${PREFIX}soft-deleted-like`,
				giftId: SOFT_DELETED_LIKE_GIFT_ID,
				userId: ACTOR_ID,
				deletedAt: new Date(),
			},
			{
				id: `${PREFIX}other-wishlist-like`,
				giftId: OTHER_WISHLIST_GIFT_ID,
				userId: ACTOR_ID,
			},
		]);
	});

	afterAll(async () => {
		if (!DB_READY) {
			return;
		}
		await getDb().delete(user).where(eq(user.id, ACTOR_ID));
		await getDb().delete(user).where(eq(user.id, OTHER_USER_ID));
		await closeDb();
	});

	it('returns only active likes by the current user on active gifts in the requested wishlist', async () => {
		await expect(
			callGetLikes({ user: { id: ACTOR_ID } }, { wishlistId: TARGET_WISHLIST_ID }),
		).resolves.toEqual([ACTIVE_TARGET_GIFT_ID]);
	});
});
