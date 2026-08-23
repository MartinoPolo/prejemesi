import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('$app/server', () => ({
	getRequestEvent: vi.fn(),
	query: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
	command: vi.fn((...args: unknown[]) => {
		const callback = args.length === 1 ? args[0] : args[1];
		return callback;
	}),
}));

vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status: number, message: string) => {
		const err = new Error(message) as Error & { status: number };
		err.status = status;
		throw err;
	}),
}));

vi.mock('$lib/server/remote.js', () => ({
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedCommandNoArgs: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/index.js', () => ({ getDb: vi.fn() }));

vi.mock('$lib/server/db/notification.schema.js', () => ({
	notification: {
		id: 'n.id',
		userId: 'n.userId',
		type: 'n.type',
		wishlistId: 'n.wishlistId',
		giftId: 'n.giftId',
		actorName: 'n.actorName',
		payload: 'n.payload',
		visibleAt: 'n.visibleAt',
		read: 'n.read',
		createdAt: 'n.createdAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'w.id',
		shortId: 'w.shortId',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: {
		id: 'user.id',
		notificationPreferences: 'user.notificationPreferences',
	},
}));

vi.mock('drizzle-orm', () => {
	const expression = (operator: string, args: unknown[]) => ({ operator, args });
	return {
		eq: vi.fn((...args: unknown[]) => expression('eq', args)),
		and: vi.fn((...args: unknown[]) => expression('and', args)),
		inArray: vi.fn((...args: unknown[]) => expression('inArray', args)),
		isNull: vi.fn((...args: unknown[]) => expression('isNull', args)),
		lte: vi.fn((...args: unknown[]) => expression('lte', args)),
		or: vi.fn((...args: unknown[]) => expression('or', args)),
		desc: vi.fn((...args: unknown[]) => expression('desc', args)),
		sql: vi.fn((...args: unknown[]) => {
			const built = expression('sql', args);
			return { ...built, mapWith: vi.fn(() => built) };
		}),
	};
});

import {
	getNotifications,
	getUnreadCount,
	markAsRead,
	getNotificationPreferences,
	updateNotificationPreferences,
} from './notifications.remote.js';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	NOTIFICATION_TYPE,
	type NotificationPreferences,
} from './types.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					return vi.fn(() => createChain());
				},
			},
		);

	return {
		select: vi.fn(() => createChain()),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
	} as unknown as ReturnType<typeof getDb>;
}

const testUser = { id: 'user-1', email: 'test@example.com' };
const testAuthContext = { user: testUser };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getNotifications', () => {
	it('returns formatted notifications for user', async () => {
		const now = new Date('2024-06-01T10:00:00Z');
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: 'notif-1',
						type: 'gift_reserved',
						wishlistId: 'wl-1',
						wishlistShortId: 'short-1',
						giftId: 'gift-1',
						actorName: 'Alice',
						read: false,
						createdAt: now,
					},
				],
			]),
		);

		const result = await (getNotifications as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual([
			{
				id: 'notif-1',
				type: 'gift_reserved',
				message: 'Dárek byl rezervován',
				wishlistId: 'wl-1',
				wishlistShortId: 'short-1',
				giftId: 'gift-1',
				actorName: 'Alice',
				digest: null,
				href: null,
				read: false,
				createdAt: now,
			},
		]);
	});

	it('returns null wishlistShortId when the wishlist no longer exists (left join)', async () => {
		const now = new Date('2024-06-01T10:00:00Z');
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: 'notif-2',
						type: 'wishlist_archived',
						wishlistId: 'wl-deleted',
						wishlistShortId: null,
						giftId: null,
						actorName: null,
						read: false,
						createdAt: now,
					},
				],
			]),
		);

		const result = await (getNotifications as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual([
			{
				id: 'notif-2',
				type: 'wishlist_archived',
				message: 'Seznam byl archivován',
				wishlistId: 'wl-deleted',
				wishlistShortId: null,
				giftId: null,
				actorName: null,
				digest: null,
				href: null,
				read: false,
				createdAt: now,
			},
		]);
	});

	it('returns the digest visibleAt as its effective public timestamp and falls back for legacy rows', async () => {
		const openedAt = new Date('2024-06-01T10:00:00Z');
		const visibleAt = new Date('2024-06-02T10:00:00Z');
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: 'digest-now',
						type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
						wishlistId: 'wl-1',
						wishlistShortId: 'short-1',
						giftId: null,
						actorName: null,
						payload: {
							version: 1,
							totalCount: 1,
							wishlistCount: 1,
							wishlists: [
								{
									wishlistId: 'wl-1',
									shortId: 'short-1',
									title: 'List',
									count: 1,
									namePreviews: ['Gift'],
								},
							],
						},
						read: false,
						createdAt: visibleAt,
					},
					{
						id: 'legacy',
						type: 'gift_reserved',
						wishlistId: 'wl-1',
						wishlistShortId: 'short-1',
						giftId: 'gift-1',
						actorName: null,
						payload: null,
						read: false,
						createdAt: openedAt,
					},
				],
			]),
		);

		const result = (await (getNotifications as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		)) as { id: string; createdAt: Date }[];
		expect(result.find(({ id }) => id === 'digest-now')?.createdAt).toBe(visibleAt);
		expect(result.find(({ id }) => id === 'legacy')?.createdAt).toBe(openedAt);
	});

	it('maps a malformed non-null digest row to the localized legacy fallback', async () => {
		const now = new Date('2024-06-01T10:00:00Z');
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: 'malformed-digest',
						type: NOTIFICATION_TYPE.NEW_GIFT_ADDED,
						wishlistId: 'wl-1',
						wishlistShortId: 'short-1',
						giftId: null,
						actorName: null,
						payload: { version: 1, totalCount: 'broken', wishlists: [] },
						read: false,
						createdAt: now,
					},
				],
			]),
		);

		const result = (await (getNotifications as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		)) as { digest: unknown; message: string }[];
		expect(result[0]).toMatchObject({ digest: null, message: 'Nový dárek na seznamu' });
	});

	it('returns empty array when no notifications', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		const result = await (getNotifications as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toEqual([]);
	});
});

describe('getUnreadCount', () => {
	it('returns the count of unread notifications', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ count: 7 }]]));

		const result = await (getUnreadCount as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toBe(7);
	});

	it('returns 0 when no unread notifications', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		const result = await (getUnreadCount as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
		);

		expect(result).toBe(0);
	});
});

describe('markAsRead', () => {
	it('no-ops when empty array passed (early return)', async () => {
		const mockDb = createMockDb([]);
		mockGetDb.mockReturnValue(mockDb);

		await (markAsRead as unknown as (...args: unknown[]) => unknown)(testAuthContext, []);

		expect(mockDb.update).not.toHaveBeenCalled();
	});
});

describe('getNotificationPreferences', () => {
	it('returns the stored preferences when the user has customized them', async () => {
		const stored = {
			...DEFAULT_NOTIFICATION_PREFERENCES,
			[NOTIFICATION_TYPE.NEW_GIFT_ADDED]: { email: false, inApp: false },
		};
		mockGetDb.mockReturnValue(createMockDb([[{ preferences: stored }]]));

		const result = await (
			getNotificationPreferences as unknown as (...args: unknown[]) => unknown
		)(testAuthContext);

		expect(result).toEqual(stored);
	});

	it('falls back to defaults when preferences are NULL (never customized)', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ preferences: null }]]));

		const result = await (
			getNotificationPreferences as unknown as (...args: unknown[]) => unknown
		)(testAuthContext);

		expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
	});

	it('falls back to defaults when the user row is missing', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		const result = await (
			getNotificationPreferences as unknown as (...args: unknown[]) => unknown
		)(testAuthContext);

		expect(result).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
	});

	it('fills in newer types missing from an older partial stored row', async () => {
		// Rows saved before a type existed omit its key; the read must backfill it from
		// defaults so the settings form never indexes an undefined entry (crash on [type].inApp).
		const partialStored = Object.fromEntries(
			Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).filter(
				([type]) => type !== NOTIFICATION_TYPE.RESERVATION_CANCELLED,
			),
		);
		mockGetDb.mockReturnValue(createMockDb([[{ preferences: partialStored }]]));

		const result = (await (
			getNotificationPreferences as unknown as (...args: unknown[]) => unknown
		)(testAuthContext)) as NotificationPreferences;

		expect(result[NOTIFICATION_TYPE.RESERVATION_CANCELLED]).toEqual(
			DEFAULT_NOTIFICATION_PREFERENCES[NOTIFICATION_TYPE.RESERVATION_CANCELLED],
		);
	});
});

describe('updateNotificationPreferences', () => {
	it('writes the preferences to the user row', async () => {
		const mockDb = createMockDb([[]]);
		mockGetDb.mockReturnValue(mockDb);

		await (updateNotificationPreferences as unknown as (...args: unknown[]) => unknown)(
			testAuthContext,
			{ preferences: DEFAULT_NOTIFICATION_PREFERENCES },
		);

		expect(mockDb.update).toHaveBeenCalled();
	});
});
