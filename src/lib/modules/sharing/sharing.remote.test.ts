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
	inArray: vi.fn((...args: unknown[]) => args),
	count: vi.fn(() => 'count'),
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: { id: 'gift.id', wishlistId: 'gift.wishlistId', deletedAt: 'gift.deletedAt' },
	reservation: {
		id: 'reservation.id',
		giftId: 'reservation.giftId',
		userId: 'reservation.userId',
		anonymousEmail: 'reservation.anonymousEmail',
		deletedAt: 'reservation.deletedAt',
	},
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

// martin is an app admin (issue #150); other users are not.
vi.mock('$env/dynamic/private', () => ({
	env: { ADMIN_EMAILS: 'martin@test.cz' },
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

import { shareWishlist, revertWishlistToDraft } from './sharing.remote.js';
import { getDb } from '$lib/server/db/index.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';
import { NOTIFICATION_TYPE } from '$lib/modules/notifications/types.js';

const mockGetDb = vi.mocked(getDb);
const mockDispatchNotification = vi.mocked(dispatchNotification);

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
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			const txProxy = {
				select: vi.fn(() => createChain()),
				insert: vi.fn(() => createChain()),
				update: vi.fn(() => createChain()),
				delete: vi.fn(() => createChain()),
			};
			return callback(txProxy);
		}),
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

/**
 * Revert-to-draft (issue #150). Expected truths derive from DECISIONS.md §"Revert to draft" and
 * §"App admin via ADMIN_EMAILS": a správce reverts a clean list silently; an app admin reverts a
 * reserved list (cancelling reservations + notifying reservers); a non-admin správce on a reserved
 * list, the recipient, and a plain visitor are all rejected; an archived list must be unarchived
 * first. The env mock makes martin@test.cz the app admin.
 */
describe('revertWishlistToDraft', () => {
	const shortId = 'revert01';
	const moderatorUser = { id: 'mod-1', email: 'mod@test.cz' };
	const adminUser = { id: 'admin-martin', email: 'martin@test.cz' };
	const recipientUser = { id: 'rec-1', email: 'rec@test.cz' };
	const visitorUser = { id: 'vis-1', email: 'vis@test.cz' };

	const callRevert = (authContext: { user: { id: string; email: string } }, id: string) =>
		(revertWishlistToDraft as unknown as (...args: unknown[]) => unknown)(authContext, id);

	/** An active (shared) for-someone list managed via moderatorAssignment. */
	const activeForSomeone = {
		id: wishlistId,
		recipientUserId: null,
		recipientName: 'Rosie',
		shortId,
		status: 'active',
		sharedAt: new Date('2026-06-01T09:00:00Z'),
		deletedAt: null,
	};

	it('a správce reverts a reservation-free list silently (no notifications)', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeForSomeone], // requireWishlistRow
				[{ id: 'ma-1' }], // hasActiveModeratorAssignment → moderator
				[{ value: 0 }], // reservation count → clean
				[], // tx: gift reset update
				[], // tx: wishlist update
			]),
		);

		const result = await callRevert({ user: moderatorUser }, wishlistId);

		expect(result).toEqual({ shortId, reverted: true });
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('rejects a non-admin správce on a list that already has reservations', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeForSomeone], // requireWishlistRow
				[{ id: 'ma-1' }], // moderator
				[{ value: 2 }], // reservation count → reserved
			]),
		);

		await expect(callRevert({ user: moderatorUser }, wishlistId)).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.REVERT_REQUIRES_ADMIN,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('an app admin reverts a reserved list: cancels reservations + notifies reservers', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeForSomeone], // requireWishlistRow
				[], // hasActiveModeratorAssignment → none (admin is a plain visitor here)
				[{ value: 2 }], // reservation count → reserved
				[
					{ id: 'r1', userId: 'gifter-1', anonymousEmail: null },
					{ id: 'r2', userId: null, anonymousEmail: 'anon@example.com' },
				], // tx: active reservations gathered
				[], // tx: reservation soft-delete
				[], // tx: gift reset update
				[], // tx: wishlist update
			]),
		);

		const result = await callRevert({ user: adminUser }, wishlistId);

		expect(result).toEqual({ shortId, reverted: true });
		expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				type: NOTIFICATION_TYPE.RESERVATION_CANCELLED,
				targetUserIds: ['gifter-1'],
				targetEmails: ['anon@example.com'],
				wishlistId,
				actorId: adminUser.id,
			}),
		);
	});

	it('rejects the recipient (they never see the revert option)', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				// requireWishlistRow: a self list whose linked recipient is the caller
				[{ ...activeForSomeone, recipientUserId: recipientUser.id, recipientName: null }],
			]),
		);

		await expect(callRevert({ user: recipientUser }, wishlistId)).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.ACCESS_DENIED,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('rejects a plain visitor', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeForSomeone], // requireWishlistRow
				[], // hasActiveModeratorAssignment → none, not admin → visitor
			]),
		);

		await expect(callRevert({ user: visitorUser }, wishlistId)).rejects.toMatchObject({
			status: 403,
			message: SERVER_ERROR.ACCESS_DENIED,
		});
	});

	it('rejects an archived list (must be unarchived first)', async () => {
		mockGetDb.mockReturnValue(
			createMockDb([
				[{ ...activeForSomeone, status: 'archived' }], // requireWishlistRow
				[{ id: 'ma-1' }], // moderator
			]),
		);

		await expect(callRevert({ user: moderatorUser }, wishlistId)).rejects.toMatchObject({
			status: 400,
			message: SERVER_ERROR.CANNOT_REVERT_ARCHIVED,
		});
	});
});
