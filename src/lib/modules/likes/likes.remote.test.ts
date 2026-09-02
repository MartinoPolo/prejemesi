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
	guardedQuery: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	count: vi.fn(() => 'count'),
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: {
		id: 'gift.id',
		wishlistId: 'gift.wishlistId',
		deletedAt: 'gift.deletedAt',
	},
	giftLike: {
		id: 'giftLike.id',
		giftId: 'giftLike.giftId',
		userId: 'giftLike.userId',
		deletedAt: 'giftLike.deletedAt',
		createdAt: 'giftLike.createdAt',
	},
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		recipientUserId: 'wishlist.recipientUserId',
		status: 'wishlist.status',
	},
}));

import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

import {
	toggleLike,
	getUserLikesForWishlist,
	getUserLikesForWishlistScoped,
} from './likes.remote.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

/**
 * Creates a mock database whose methods return queryResults in order.
 * Each element in queryResults is the resolved value for one awaited query chain.
 */
function createMockDb(
	queryResults: unknown[][],
	calls: Array<{ method: string; args: unknown[] }> = [],
): ReturnType<typeof getDb> {
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
					return vi.fn((...args: unknown[]) => {
						calls.push({ method: String(prop), args });
						return createChain();
					});
				},
			},
		);

	return {
		select: vi.fn((...args: unknown[]) => {
			calls.push({ method: 'select', args });
			return createChain();
		}),
		insert: vi.fn(() => createChain()),
		update: vi.fn(() => createChain()),
		delete: vi.fn(() => createChain()),
	} as unknown as ReturnType<typeof getDb>;
}

const testUser = { id: 'user-1', email: 'test@example.com' };
const testAuthContext = { user: testUser };
const testInput = { giftId: 'gift-abc' };

const callToggleLike = (authContext: typeof testAuthContext, input: typeof testInput) =>
	(toggleLike as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callGetUserLikesForWishlist = (authContext: typeof testAuthContext) =>
	(getUserLikesForWishlist as unknown as (...args: unknown[]) => unknown)(authContext);
const callGetUserLikesForWishlistScoped = (
	authContext: typeof testAuthContext,
	input: { wishlistId: string },
) =>
	(getUserLikesForWishlistScoped as unknown as (...args: unknown[]) => unknown)(
		authContext,
		input,
	);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('toggleLike', () => {
	it('throws 404 when the gift is not found', async () => {
		// Query 1: gift lookup → empty
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(callToggleLike(testAuthContext, testInput)).rejects.toMatchObject({
			status: 404,
			message: 'Gift not found',
		});
	});

	it('throws 404 when the wishlist is not found', async () => {
		// Query 1: gift found, Query 2: wishlist → empty
		mockGetDb.mockReturnValue(createMockDb([[{ id: 'gift-abc', wishlistId: 'wl-1' }], []]));

		await expect(callToggleLike(testAuthContext, testInput)).rejects.toMatchObject({
			status: 404,
			message: 'Wishlist not found',
		});
	});

	it('throws 400 when the wishlist is archived', async () => {
		// Query 1: gift found, Query 2: wishlist with status archived
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ id: 'gift-abc', wishlistId: 'wl-1' }],
				[{ recipientUserId: 'recipient-other', status: 'archived' }],
			]),
		);

		await expect(callToggleLike(testAuthContext, testInput)).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_LIKE_ON_ARCHIVED,
		});
	});

	it('throws 403 when the caller is the linked recipient of their own list', async () => {
		// Query 1: gift found, Query 2: wishlist whose recipientUserId is the caller
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ id: 'gift-abc', wishlistId: 'wl-1' }],
				[{ recipientUserId: testUser.id }],
			]),
		);

		await expect(callToggleLike(testAuthContext, testInput)).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS,
		});
	});

	it('inserts a new like and returns liked: true with likeCount when no existing like', async () => {
		// Query 1: gift, Query 2: wishlist (different owner), Query 3: existing likes → none,
		// Query 4: insert (mutation – ignored), Query 5: count result
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ id: 'gift-abc', wishlistId: 'wl-1' }],
				[{ recipientUserId: 'recipient-other' }],
				[], // no existing like
				[], // insert mutation result (ignored)
				[{ count: 3 }], // updated count
			]),
		);

		const result = await callToggleLike(testAuthContext, testInput);

		expect(result).toEqual({ liked: true, likeCount: 3 });
	});

	it('soft-deletes an active like and returns liked: false with likeCount (unlike)', async () => {
		// Query 1: gift, Query 2: wishlist, Query 3: existing active like (deletedAt: null),
		// Query 4: update mutation, Query 5: count
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ id: 'gift-abc', wishlistId: 'wl-1' }],
				[{ recipientUserId: 'recipient-other' }],
				[{ id: 'like-1', giftId: 'gift-abc', userId: testUser.id, deletedAt: null }],
				[], // update mutation result
				[{ count: 2 }],
			]),
		);

		const result = await callToggleLike(testAuthContext, testInput);

		expect(result).toEqual({ liked: false, likeCount: 2 });
	});

	it('re-activates a soft-deleted like and returns liked: true with likeCount (re-like)', async () => {
		// Query 1: gift, Query 2: wishlist, Query 3: existing soft-deleted like (deletedAt set),
		// Query 4: update mutation, Query 5: count
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ id: 'gift-abc', wishlistId: 'wl-1' }],
				[{ recipientUserId: 'recipient-other' }],
				[
					{
						id: 'like-1',
						giftId: 'gift-abc',
						userId: testUser.id,
						deletedAt: new Date('2024-01-01'),
					},
				],
				[], // update mutation result
				[{ count: 5 }],
			]),
		);

		const result = await callToggleLike(testAuthContext, testInput);

		expect(result).toEqual({ liked: true, likeCount: 5 });
	});
});

describe('getUserLikesForWishlist', () => {
	it('retains the legacy no-argument behavior for open browser clients', async () => {
		mockGetDb.mockReturnValue(createMockDb([[{ giftId: 'gift-1' }, { giftId: 'gift-2' }]]));
		await expect(callGetUserLikesForWishlist(testAuthContext)).resolves.toEqual([
			'gift-1',
			'gift-2',
		]);
	});
});

describe('getUserLikesForWishlistScoped', () => {
	it('returns only active current-user likes joined to active gifts in the requested wishlist', async () => {
		const calls: Array<{ method: string; args: unknown[] }> = [];
		mockGetDb.mockReturnValue(createMockDb([[{ giftId: 'gift-1' }]], calls));

		const result = await callGetUserLikesForWishlistScoped(testAuthContext, {
			wishlistId: 'wishlist-1',
		});

		expect(result).toEqual(['gift-1']);
		expect(calls).toContainEqual({
			method: 'innerJoin',
			args: [expect.objectContaining({ id: 'gift.id' }), ['giftLike.giftId', 'gift.id']],
		});
		expect(calls).toContainEqual({
			method: 'where',
			args: [
				[
					['giftLike.userId', testUser.id],
					'giftLike.deletedAt',
					['gift.wishlistId', 'wishlist-1'],
					'gift.deletedAt',
				],
			],
		});
	});

	it('returns an empty array when the user has no active likes in the wishlist', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		const result = await callGetUserLikesForWishlistScoped(testAuthContext, {
			wishlistId: 'wishlist-1',
		});

		expect(result).toEqual([]);
	});
});
