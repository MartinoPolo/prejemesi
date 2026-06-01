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
	guardedCommand: vi.fn((handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'command' };
		return wrapped;
	}),
	guardedQueryWithArgs: vi.fn((handler: (...args: unknown[]) => unknown) => {
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
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'w.id',
		ownerId: 'w.ownerId',
		shortId: 'w.shortId',
		deletedAt: 'w.deletedAt',
		ownerIsModerator: 'w.ownerIsModerator',
		updatedAt: 'w.updatedAt',
	},
}));

vi.mock('$lib/server/db/moderator.schema.js', () => ({
	moderatorAssignment: {
		id: 'ma.id',
		wishlistId: 'ma.wishlistId',
		userId: 'ma.userId',
		deletedAt: 'ma.deletedAt',
		assignedAt: 'ma.assignedAt',
	},
	moderatorInvite: {
		id: 'mi.id',
		token: 'mi.token',
		wishlistId: 'mi.wishlistId',
		createdByUserId: 'mi.createdByUserId',
		usedByUserId: 'mi.usedByUserId',
		usedAt: 'mi.usedAt',
		revokedAt: 'mi.revokedAt',
		createdAt: 'mi.createdAt',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: { id: 'u.id', name: 'u.name', image: 'u.image' },
}));

import {
	acceptModeratorInvite,
	revokeModeratorInvite,
	removeModerator,
	selfPromoteToModerator,
	getModeratorsForWishlist,
} from './moderators.remote.js';
import { getDb } from '$lib/server/db/index.js';

const mockGetDb = vi.mocked(getDb);

/**
 * Creates a mock database whose chained query methods resolve to sequential
 * entries from queryResults. Each entry is the resolved value for one awaited
 * query chain.
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

// ── Shared fixtures ──────────────────────────────────────────────────────────

const ownerUser = { id: 'owner-1', email: 'owner@example.com' };
const regularUser = { id: 'user-2', email: 'user@example.com' };

const ownerAuthContext = { user: ownerUser };
const regularAuthContext = { user: regularUser };

const testWishlistId = 'wl-abc';
const testInviteId = 'inv-abc';
const testInviteToken = 'tok-abc';
const testAssignmentId = 'asgn-abc';

const activeWishlistRow = {
	id: testWishlistId,
	ownerId: ownerUser.id,
	shortId: 'short-abc',
	title: 'Test List',
	ownerIsModerator: false,
	deletedAt: null,
};

const pendingInviteRow = {
	id: testInviteId,
	token: testInviteToken,
	wishlistId: testWishlistId,
	createdByUserId: ownerUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2025-01-01'),
};

const activeAssignmentRow = {
	id: testAssignmentId,
	wishlistId: testWishlistId,
	userId: regularUser.id,
	deletedAt: null,
	assignedAt: new Date('2025-01-01'),
};

// ── Helper wrappers (bypass TS signature enforcement on mocked functions) ────

const callAcceptModeratorInvite = (
	authContext: typeof ownerAuthContext,
	input: { token: string },
) => (acceptModeratorInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRevokeModeratorInvite = (
	authContext: typeof ownerAuthContext,
	input: { inviteId: string },
) => (revokeModeratorInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRemoveModerator = (
	authContext: typeof ownerAuthContext,
	input: { assignmentId: string },
) => (removeModerator as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callSelfPromoteToModerator = (
	authContext: typeof ownerAuthContext,
	input: { wishlistId: string },
) => (selfPromoteToModerator as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callGetModeratorsForWishlist = (authContext: typeof ownerAuthContext, wishlistId: string) =>
	(getModeratorsForWishlist as unknown as (...args: unknown[]) => unknown)(
		authContext,
		wishlistId,
	);

// ── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
});

// ── acceptModeratorInvite ────────────────────────────────────────────────────

describe('acceptModeratorInvite', () => {
	it('valid invite → creates assignment and returns wishlist info', async () => {
		// 1: invite lookup, 2: wishlist lookup, 3: existing mod check → none,
		// 4: update invite (mark used), 5: insert assignment → returns row
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingInviteRow],
				[activeWishlistRow],
				[], // not already a moderator
				[], // update invite mutation
				[{ id: testAssignmentId, wishlistId: testWishlistId, userId: regularUser.id }],
			]),
		);

		const result = await callAcceptModeratorInvite(regularAuthContext, {
			token: testInviteToken,
		});

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: activeWishlistRow.shortId,
			wishlistTitle: activeWishlistRow.title,
		});
	});

	it('invite not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: 'nonexistent-token' }),
		).rejects.toMatchObject({ status: 404, message: 'INVITE_NOT_FOUND' });
	});

	it('revoked invite → throws 400', async () => {
		const revokedInvite = { ...pendingInviteRow, revokedAt: new Date('2025-02-01') };
		mockGetDb.mockReturnValue(createMockDb([[revokedInvite]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});

	it('already used invite → throws 400', async () => {
		const usedInvite = {
			...pendingInviteRow,
			usedAt: new Date('2025-02-01'),
			usedByUserId: regularUser.id,
		};
		mockGetDb.mockReturnValue(createMockDb([[usedInvite]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('owner accepting own invite → throws 400', async () => {
		// 1: invite found, 2: wishlist found (owner matches currentUser)
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [activeWishlistRow]]));

		await expect(
			callAcceptModeratorInvite(ownerAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({
			status: 400,
			message: 'OWNER_CANNOT_ACCEPT_OWN_INVITE',
		});
	});

	it('user already a moderator → throws 400', async () => {
		// 1: invite found, 2: wishlist found, 3: existing assignment found
		mockGetDb.mockReturnValue(
			createMockDb([[pendingInviteRow], [activeWishlistRow], [activeAssignmentRow]]),
		);

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'ALREADY_MODERATOR' });
	});
});

// ── revokeModeratorInvite ────────────────────────────────────────────────────

describe('revokeModeratorInvite', () => {
	it('owner revokes pending invite → succeeds (no return value)', async () => {
		// 1: invite lookup, 2: wishlist lookup (verifyWishlistOwner), 3: update (revoke)
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [activeWishlistRow], []]));

		const result = await callRevokeModeratorInvite(ownerAuthContext, {
			inviteId: testInviteId,
		});

		expect(result).toBeUndefined();
	});

	it('already used invite → throws 400', async () => {
		const usedInvite = {
			...pendingInviteRow,
			usedAt: new Date('2025-02-01'),
			usedByUserId: regularUser.id,
		};
		// 1: invite lookup, 2: wishlist lookup
		mockGetDb.mockReturnValue(createMockDb([[usedInvite], [activeWishlistRow]]));

		await expect(
			callRevokeModeratorInvite(ownerAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('already revoked invite → throws 400', async () => {
		const revokedInvite = { ...pendingInviteRow, revokedAt: new Date('2025-02-01') };
		// 1: invite lookup, 2: wishlist lookup
		mockGetDb.mockReturnValue(createMockDb([[revokedInvite], [activeWishlistRow]]));

		await expect(
			callRevokeModeratorInvite(ownerAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});
});

// ── removeModerator ──────────────────────────────────────────────────────────

describe('removeModerator', () => {
	it('owner removes moderator → succeeds (no return value)', async () => {
		// 1: assignment lookup, 2: wishlist lookup (verifyWishlistOwner), 3: soft-delete update
		mockGetDb.mockReturnValue(createMockDb([[activeAssignmentRow], [activeWishlistRow], []]));

		const result = await callRemoveModerator(ownerAuthContext, {
			assignmentId: testAssignmentId,
		});

		expect(result).toBeUndefined();
	});

	it('assignment not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callRemoveModerator(ownerAuthContext, { assignmentId: 'nonexistent-id' }),
		).rejects.toMatchObject({ status: 404, message: 'MODERATOR_NOT_FOUND' });
	});
});

// ── selfPromoteToModerator ───────────────────────────────────────────────────

describe('selfPromoteToModerator', () => {
	it('owner promotes self → returns success', async () => {
		// 1: wishlist lookup (verifyWishlistOwner), 2: update wishlist
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], []]));

		const result = await callSelfPromoteToModerator(ownerAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({ success: true });
	});

	it('already promoted → throws 400', async () => {
		const alreadyPromotedWishlistRow = { ...activeWishlistRow, ownerIsModerator: true };
		mockGetDb.mockReturnValue(createMockDb([[alreadyPromotedWishlistRow]]));

		await expect(
			callSelfPromoteToModerator(ownerAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'ALREADY_SEEING_RESERVATIONS' });
	});
});

// ── getModeratorsForWishlist ─────────────────────────────────────────────────

describe('getModeratorsForWishlist', () => {
	it('owner sees moderators and pending invites', async () => {
		const moderatorRow = {
			id: testAssignmentId,
			userId: regularUser.id,
			userName: 'Test User',
			userImage: null,
			assignedAt: new Date('2025-01-01'),
		};
		const inviteRow = {
			id: testInviteId,
			token: testInviteToken,
			createdAt: new Date('2025-01-01'),
			usedAt: null,
			revokedAt: null,
		};

		// 1: wishlist lookup, 2: moderators select, 3: pending invites select
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [moderatorRow], [inviteRow]]));

		const result = await callGetModeratorsForWishlist(ownerAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [inviteRow],
			ownerIsModerator: false,
		});
	});

	it('moderator sees moderators but not pending invites', async () => {
		const nonOwnerWishlist = { ...activeWishlistRow, ownerId: 'different-owner' };
		const moderatorRow = {
			id: testAssignmentId,
			userId: regularUser.id,
			userName: 'Test User',
			userImage: null,
			assignedAt: new Date('2025-01-01'),
		};

		// 1: wishlist lookup (user is not owner), 2: mod check → found,
		// 3: moderators select, (no invite query for non-owners)
		mockGetDb.mockReturnValue(
			createMockDb([[nonOwnerWishlist], [activeAssignmentRow], [moderatorRow]]),
		);

		const result = await callGetModeratorsForWishlist(regularAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [],
			ownerIsModerator: false,
		});
	});

	it('wishlist not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callGetModeratorsForWishlist(ownerAuthContext, 'nonexistent-wl'),
		).rejects.toMatchObject({ status: 404, message: 'WISHLIST_NOT_FOUND' });
	});

	it('non-owner non-moderator → throws 403', async () => {
		const nonOwnerWishlist = { ...activeWishlistRow, ownerId: 'different-owner' };

		// 1: wishlist lookup (not owner), 2: mod check → empty (not a mod)
		mockGetDb.mockReturnValue(createMockDb([[nonOwnerWishlist], []]));

		await expect(
			callGetModeratorsForWishlist(regularAuthContext, testWishlistId),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});
});
