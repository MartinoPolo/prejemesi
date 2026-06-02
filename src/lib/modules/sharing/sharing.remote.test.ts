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
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		ownerId: 'wishlist.ownerId',
		shortId: 'wishlist.shortId',
		sharedAt: 'wishlist.sharedAt',
		status: 'wishlist.status',
		deletedAt: 'wishlist.deletedAt',
		updatedAt: 'wishlist.updatedAt',
	},
}));

import { shareWishlist } from './sharing.remote.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

/**
 * Creates a mock database whose methods return queryResults in order.
 * Each element in queryResults is the resolved value for one awaited query chain.
 */
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
const wishlistId = 'wishlist-abc';

const callShareWishlist = (authContext: typeof testAuthContext, id: string) =>
	(shareWishlist as unknown as (...args: unknown[]) => unknown)(authContext, id);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('shareWishlist', () => {
	it('throws 404 when wishlist not found', async () => {
		// Query 1: wishlist lookup → empty (not found)
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(callShareWishlist(testAuthContext, wishlistId)).rejects.toMatchObject({
			status: 404,
			message: 'Wishlist not found',
		});
	});

	it('throws 403 when user is not the owner', async () => {
		// Query 1: wishlist found but owned by a different user
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						ownerId: 'other-user',
						shortId: 'abc123',
						sharedAt: null,
						status: 'draft',
					},
				],
			]),
		);

		await expect(callShareWishlist(testAuthContext, wishlistId)).rejects.toMatchObject({
			status: 403,
			message: 'Not authorized',
		});
	});

	it('throws 400 when wishlist is archived', async () => {
		// Query 1: wishlist found, owned by user, but archived
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						ownerId: testUser.id,
						shortId: 'abc123',
						sharedAt: null,
						status: 'archived',
					},
				],
			]),
		);

		await expect(callShareWishlist(testAuthContext, wishlistId)).rejects.toMatchObject({
			status: 400,
			message: 'Cannot share an archived wishlist',
		});
	});

	it('returns alreadyShared: true when already shared (idempotent)', async () => {
		// Query 1: wishlist found, owned by user, already shared (sharedAt set)
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						ownerId: testUser.id,
						shortId: 'abc123',
						sharedAt: new Date('2024-01-01'),
						status: 'active',
					},
				],
			]),
		);

		const result = await callShareWishlist(testAuthContext, wishlistId);

		expect(result).toEqual({ shortId: 'abc123', alreadyShared: true });
	});

	it('sets sharedAt and status=active on first share', async () => {
		// Query 1: wishlist found, owned by user, not yet shared (sharedAt: null)
		// Query 2: update mutation result (ignored)
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						ownerId: testUser.id,
						shortId: 'abc123',
						sharedAt: null,
						status: 'draft',
					},
				],
				[], // update mutation result
			]),
		);

		const result = await callShareWishlist(testAuthContext, wishlistId);

		expect(result).toEqual({ shortId: 'abc123', alreadyShared: false });
	});
});
