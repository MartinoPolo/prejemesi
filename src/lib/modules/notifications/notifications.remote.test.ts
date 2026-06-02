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
		read: 'n.read',
		createdAt: 'n.createdAt',
	},
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...a: unknown[]) => a),
	and: vi.fn((...a: unknown[]) => a),
	inArray: vi.fn((...a: unknown[]) => a),
	desc: vi.fn((a: unknown) => a),
	sql: vi.fn(),
}));

import { getNotifications, getUnreadCount, markAsRead } from './notifications.remote.js';
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
				message: 'Gift was reserved',
				wishlistId: 'wl-1',
				giftId: 'gift-1',
				actorName: 'Alice',
				read: false,
				createdAt: now,
			},
		]);
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
