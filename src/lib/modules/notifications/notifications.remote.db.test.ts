import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

const databaseUrl = process.env.DATABASE_URL ?? '';
function isLocalDatabaseUrl(value: string): boolean {
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
	} catch {
		return false;
	}
}

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: vi.fn() }));
vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: process.env.DATABASE_URL } }));
function remoteHandler(handler: (...args: unknown[]) => unknown) {
	(handler as unknown as { __: object }).__ = {};
	return handler;
}
vi.mock('$lib/server/remote.js', () => ({
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => remoteHandler(handler)),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) =>
		remoteHandler(handler),
	),
	guardedCommandNoArgs: vi.fn((handler: (...args: unknown[]) => unknown) =>
		remoteHandler(handler),
	),
}));

import { closeDb, getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { notification } from '$lib/server/db/notification.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import {
	getNotifications,
	getUnreadCount,
	markAllAsRead,
	markAsRead,
} from './notifications.remote.js';
import { NOTIFICATION_TYPE } from './types.js';
import { load as loadAppLayout } from '../../../routes/(app)/+layout.server.js';

const PREFIX = `test-notification-visibility-${Date.now()}-`;
const USER_ID = `${PREFIX}user`;
const WISHLIST_ID = `${PREFIX}wishlist`;
const IDS = {
	legacy: `${PREFIX}legacy`,
	past: `${PREFIX}past`,
	future: `${PREFIX}future`,
};
const auth = { user: { id: USER_ID } };

class ProbeRollback extends Error {}
async function isDbUsable(): Promise<boolean> {
	if (!isLocalDatabaseUrl(databaseUrl)) {
		return false;
	}
	try {
		await getDb().transaction(async (tx) => {
			await tx.select({ visibleAt: notification.visibleAt }).from(notification).limit(1);
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

type Handler = (...args: unknown[]) => Promise<unknown>;

describe.skipIf(!DB_READY)('notification delayed visibility handlers [real DB]', () => {
	beforeAll(async () => {
		await getDb()
			.insert(user)
			.values({
				id: USER_ID,
				name: 'Notification visibility user',
				email: `${PREFIX}user@example.com`,
			});
		await getDb()
			.insert(wishlist)
			.values({
				id: WISHLIST_ID,
				shortId: `${PREFIX}short`,
				recipientUserId: USER_ID,
				recipientName: null,
				title: 'Notification visibility',
			});
		const now = Date.now();
		await getDb()
			.insert(notification)
			.values([
				{
					id: IDS.legacy,
					userId: USER_ID,
					type: NOTIFICATION_TYPE.GIFT_RESERVED,
					wishlistId: WISHLIST_ID,
					visibleAt: null,
				},
				{
					id: IDS.past,
					userId: USER_ID,
					type: NOTIFICATION_TYPE.GIFT_RESERVED,
					wishlistId: WISHLIST_ID,
					visibleAt: new Date(now - 60_000),
				},
				{
					id: IDS.future,
					userId: USER_ID,
					type: NOTIFICATION_TYPE.GIFT_RESERVED,
					wishlistId: WISHLIST_ID,
					visibleAt: new Date(now + 60 * 60_000),
				},
			]);
	});

	afterAll(async () => {
		await getDb()
			.delete(notification)
			.where(inArray(notification.id, Object.values(IDS)));
		await getDb().delete(wishlist).where(eq(wishlist.id, WISHLIST_ID));
		await getDb().delete(user).where(eq(user.id, USER_ID));
		await closeDb();
	});

	it('lists and counts only visible rows and refuses to mark a future row', async () => {
		const rows = (await (getNotifications as unknown as Handler)(auth)) as { id: string }[];
		expect(rows.map((row) => row.id).sort()).toEqual([IDS.legacy, IDS.past].sort());
		expect(await (getUnreadCount as unknown as Handler)(auth)).toBe(2);

		await (markAsRead as unknown as Handler)(auth, [IDS.past, IDS.future]);
		const stored = await getDb()
			.select({ id: notification.id, read: notification.read })
			.from(notification)
			.where(inArray(notification.id, [IDS.past, IDS.future]));
		expect(stored.find((row) => row.id === IDS.past)?.read).toBe(true);
		expect(stored.find((row) => row.id === IDS.future)?.read).toBe(false);
		expect(await (getUnreadCount as unknown as Handler)(auth)).toBe(1);
	});

	it('orders and returns a newly delivered digest by its effective delivery time', async () => {
		const deliveredId = `${PREFIX}newly-delivered`;
		const fillerIds = Array.from({ length: 51 }, (_, index) => `${PREFIX}filler-${index}`);
		const now = Date.now();
		const deliveredAt = new Date(now - 500);
		await getDb()
			.insert(notification)
			.values([
				...fillerIds.map((id, index) => ({
					id,
					userId: USER_ID,
					type: NOTIFICATION_TYPE.GIFT_RESERVED,
					wishlistId: WISHLIST_ID,
					read: true,
					createdAt: new Date(now - index * 1_000),
				})),
				{
					id: deliveredId,
					userId: USER_ID,
					type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
					wishlistId: WISHLIST_ID,
					read: true,
					createdAt: new Date(now - 24 * 60 * 60_000),
					visibleAt: deliveredAt,
				},
			]);

		try {
			const rows = (await (getNotifications as unknown as Handler)(auth)) as {
				id: string;
				createdAt: Date;
			}[];
			expect(rows).toHaveLength(50);
			expect(rows.find(({ id }) => id === deliveredId)?.createdAt).toEqual(deliveredAt);
		} finally {
			await getDb()
				.delete(notification)
				.where(inArray(notification.id, [deliveredId, ...fillerIds]));
		}
	});

	it('initial app layout count excludes a future-visible unread digest', async () => {
		await getDb()
			.update(notification)
			.set({ read: false })
			.where(inArray(notification.id, Object.values(IDS)));

		const result = await loadAppLayout({
			locals: { session: {}, user: { id: USER_ID } },
			url: new URL('https://example.test/followed'),
		} as never);

		expect(result).toMatchObject({ unreadNotificationCount: 2 });
	});

	it('mark-all marks legacy and past rows but leaves the future row unread', async () => {
		await getDb()
			.update(notification)
			.set({ read: false })
			.where(inArray(notification.id, Object.values(IDS)));
		await (markAllAsRead as unknown as Handler)(auth);

		const stored = await getDb()
			.select({ id: notification.id, read: notification.read })
			.from(notification)
			.where(inArray(notification.id, Object.values(IDS)));
		expect(stored.find((row) => row.id === IDS.legacy)?.read).toBe(true);
		expect(stored.find((row) => row.id === IDS.past)?.read).toBe(true);
		expect(stored.find((row) => row.id === IDS.future)?.read).toBe(false);
	});
});
