import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

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
	// Single-flight refresh is a runtime-only concern (no-op outside remote requests).
	singleFlightRefresh: vi.fn(),
	guardedCommand: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
}));

// Cross-module queries referenced only for single-flight refreshes (issue #108);
// mocked so this suite does not load the other module's schema graph.
vi.mock('$lib/modules/wishlists/wishlists.remote.js', () => ({
	getWishlistByShortId: vi.fn(),
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

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'wishlist.id',
		recipientUserId: 'wishlist.recipientUserId',
		recipientName: 'wishlist.recipientName',
		recipientIsModerator: 'wishlist.recipientIsModerator',
		shortId: 'wishlist.shortId',
		sharedAt: 'wishlist.sharedAt',
		status: 'wishlist.status',
		deletedAt: 'wishlist.deletedAt',
		updatedAt: 'wishlist.updatedAt',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'moderatorAssignment.id',
		wishlistId: 'moderatorAssignment.wishlistId',
		userId: 'moderatorAssignment.userId',
		deletedAt: 'moderatorAssignment.deletedAt',
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
			message: SERVER_ERROR.WISHLIST_NOT_FOUND,
		});
	});

	it('throws 403 ACCESS_DENIED when the caller is neither recipient nor moderator', async () => {
		// Query 1: wishlist found but linked to a different recipient.
		// Query 2: moderator assignment lookup → empty (caller is a plain visitor).
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						recipientUserId: 'other-user',
						shortId: 'abc123',
						sharedAt: null,
						status: 'draft',
					},
				],
				[], // no moderator assignment
			]),
		);

		await expect(callShareWishlist(testAuthContext, wishlistId)).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.ACCESS_DENIED,
		});
	});

	it('throws 400 when wishlist is archived', async () => {
		// Query 1: wishlist found, caller is the linked recipient, but archived.
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						recipientUserId: testUser.id,
						shortId: 'abc123',
						sharedAt: null,
						status: 'archived',
					},
				],
			]),
		);

		await expect(callShareWishlist(testAuthContext, wishlistId)).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_SHARE_ARCHIVED_WISHLIST,
		});
	});

	it('returns alreadyShared: true when already shared (idempotent)', async () => {
		// Query 1: wishlist found, caller is the linked recipient, already shared (sharedAt set)
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						recipientUserId: testUser.id,
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
		// Query 1: wishlist found, caller is the linked recipient, not yet shared (sharedAt: null)
		// Query 2: update mutation result (ignored)
		mockGetDb.mockReturnValue(
			createMockDb([
				[
					{
						id: wishlistId,
						recipientUserId: testUser.id,
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
