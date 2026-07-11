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
	guardedQueryWithArgs: vi.fn((_schema: unknown, handler: (...args: unknown[]) => unknown) => {
		const wrapped = (...args: unknown[]) => handler(...args);
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	}),
}));

vi.mock('$lib/server/db/index.js', () => ({
	getDb: vi.fn(),
}));

vi.mock('$lib/modules/notifications/notification_dispatcher.js', () => ({
	dispatchNotification: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((...args: unknown[]) => args),
	and: vi.fn((...args: unknown[]) => args),
	isNull: vi.fn((arg: unknown) => arg),
	count: vi.fn(() => 'count()'),
}));

vi.mock('$lib/server/db/wishlist.schema.js', () => ({
	wishlist: {
		id: 'w.id',
		recipientUserId: 'w.recipientUserId',
		recipientName: 'w.recipientName',
		recipientIsModerator: 'w.recipientIsModerator',
		shortId: 'w.shortId',
		status: 'w.status',
		deletedAt: 'w.deletedAt',
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

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wf.wishlistId',
		userId: 'wf.userId',
		unfollowedAt: 'wf.unfollowedAt',
	},
}));

import {
	acceptModeratorInvite,
	generateModeratorInviteLink,
	revokeModeratorInvite,
	removeModerator,
	selfPromoteToModerator,
	getModeratorsForWishlist,
} from './moderators.remote.js';
import { getDb } from '$lib/server/db/index.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';

const mockGetDb = vi.mocked(getDb);
const mockDispatchNotification = vi.mocked(dispatchNotification);

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

// ── Shared fixtures ──────────────────────────────────────────────────────────

// `recipientUser` is the linked recipient of the self list (`activeWishlistRow`) — manages it
// inherently, so `verifyManagerAccess`/`resolveWishlistRole` match without a mod-assignment query.
const recipientUser = { id: 'recipient-1', email: 'recipient@example.com' };
const regularUser = { id: 'user-2', email: 'user@example.com' };

const recipientAuthContext = { user: recipientUser };
const regularAuthContext = { user: regularUser };

const testWishlistId = 'wl-abc';
const testInviteId = 'inv-abc';
const testInviteToken = 'tok-abc';
const testAssignmentId = 'asgn-abc';

/** A "self" list: the linked recipient (`recipientUser`) is the manager; no free-text name. */
const activeWishlistRow = {
	id: testWishlistId,
	recipientUserId: recipientUser.id,
	recipientName: null,
	recipientIsModerator: false,
	shortId: 'short-abc',
	title: 'Test List',
	status: 'active',
	deletedAt: null,
};

/** A "for-someone" list: no linked recipient, free-text name, managed only via moderatorAssignment. */
const forSomeoneWishlistRow = {
	id: testWishlistId,
	recipientUserId: null,
	recipientName: 'Grandma',
	recipientIsModerator: false,
	shortId: 'short-abc',
	title: 'Test List',
	status: 'active',
	deletedAt: null,
};

const pendingInviteRow = {
	id: testInviteId,
	token: testInviteToken,
	wishlistId: testWishlistId,
	createdByUserId: recipientUser.id,
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
	authContext: typeof recipientAuthContext,
	input: { token: string },
) => (acceptModeratorInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRevokeModeratorInvite = (
	authContext: typeof recipientAuthContext,
	input: { inviteId: string },
) => (revokeModeratorInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRemoveModerator = (
	authContext: typeof recipientAuthContext,
	input: { assignmentId: string },
) => (removeModerator as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callGenerateModeratorInviteLink = (
	authContext: typeof recipientAuthContext,
	input: { wishlistId: string; email?: string },
) =>
	(generateModeratorInviteLink as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callSelfPromoteToModerator = (
	authContext: typeof recipientAuthContext,
	input: { wishlistId: string },
) => (selfPromoteToModerator as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callGetModeratorsForWishlist = (
	authContext: typeof recipientAuthContext,
	wishlistId: string,
) =>
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

	it('linked recipient accepting own invite → throws 400', async () => {
		// 1: invite found, 2: wishlist found (recipientUserId matches currentUser)
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [activeWishlistRow]]));

		await expect(
			callAcceptModeratorInvite(recipientAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({
			status: 400,
			message: 'RECIPIENT_CANNOT_ACCEPT_OWN_INVITE',
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

	it('archived wishlist → throws 400', async () => {
		const archivedWishlistRow = { ...activeWishlistRow, status: 'archived' };
		// 1: invite found, 2: wishlist found with archived status
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [archivedWishlistRow]]));

		await expect(
			callAcceptModeratorInvite(regularAuthContext, { token: testInviteToken }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});
});

// ── generateModeratorInviteLink ──────────────────────────────────────────────

const createdInviteRow = {
	id: 'inv-new',
	token: 'tok-new',
	wishlistId: testWishlistId,
	createdByUserId: recipientUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2025-03-01'),
};

describe('generateModeratorInviteLink', () => {
	it('archived wishlist → throws 400', async () => {
		const archivedWishlistRow = { ...activeWishlistRow, status: 'archived' };
		// 1: requireWishlistRow (recipient = manager, no mod query)
		mockGetDb.mockReturnValue(createMockDb([[archivedWishlistRow]]));

		await expect(
			callGenerateModeratorInviteLink(recipientAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});

	it('without email → returns token + invitePath, does NOT call dispatchNotification', async () => {
		// 1: requireWishlistRow, 2: insert invite → returns created row
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [createdInviteRow]]));

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('a moderator (not the recipient) may also generate an invite link', async () => {
		// 1: requireWishlistRow (for-someone list, caller not recipient),
		// 2: hasActiveModeratorAssignment → found, 3: insert invite → created row
		mockGetDb.mockReturnValue(
			createMockDb([[forSomeoneWishlistRow], [{ id: 'assignment-1' }], [createdInviteRow]]),
		);

		const result = await callGenerateModeratorInviteLink(regularAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${forSomeoneWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
	});

	it('with email → dispatches MODERATOR_INVITED to targetEmails with urlPathOverride pointing to invite path', async () => {
		const testEmail = 'invitee@example.com';
		// 1: requireWishlistRow, 2: insert invite → created row, 3: user lookup → not registered
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [createdInviteRow], []]));

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		const expectedInvitePath = `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`;

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: expectedInvitePath,
			unregisteredInvitee: true,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'moderator_invited',
			targetEmails: [testEmail],
			wishlistId: testWishlistId,
			actorId: recipientUser.id,
			actorName: undefined,
			urlPathOverride: expectedInvitePath,
		});
	});

	it('with email of a registered user → unregisteredInvitee is false', async () => {
		const testEmail = regularUser.email;
		// 1: requireWishlistRow, 2: insert invite → created row, 3: user lookup → registered user found
		mockGetDb.mockReturnValue(
			createMockDb([[activeWishlistRow], [createdInviteRow], [{ id: regularUser.id }]]),
		);

		const result = await callGenerateModeratorInviteLink(recipientAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		expect(result).toEqual({
			token: createdInviteRow.token,
			invitePath: `/w/${activeWishlistRow.shortId}/invite/${createdInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
	});
});

// ── revokeModeratorInvite ────────────────────────────────────────────────────

describe('revokeModeratorInvite', () => {
	it('recipient revokes pending invite → succeeds (no return value)', async () => {
		// 1: invite lookup, 2: requireWishlistRow (recipient = manager, no mod query), 3: update (revoke)
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [activeWishlistRow], []]));

		const result = await callRevokeModeratorInvite(recipientAuthContext, {
			inviteId: testInviteId,
		});

		expect(result).toBeUndefined();
	});

	it('non-manager cannot revoke → throws 403 ACCESS_DENIED', async () => {
		// 1: invite lookup, 2: requireWishlistRow (for-someone), 3: hasActiveModeratorAssignment → none
		mockGetDb.mockReturnValue(createMockDb([[pendingInviteRow], [forSomeoneWishlistRow], []]));

		await expect(
			callRevokeModeratorInvite(regularAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});

	it('already used invite → throws 400', async () => {
		const usedInvite = {
			...pendingInviteRow,
			usedAt: new Date('2025-02-01'),
			usedByUserId: regularUser.id,
		};
		// 1: invite lookup, 2: requireWishlistRow (recipient = manager, no mod query)
		mockGetDb.mockReturnValue(createMockDb([[usedInvite], [activeWishlistRow]]));

		await expect(
			callRevokeModeratorInvite(recipientAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('already revoked invite → throws 400', async () => {
		const revokedInvite = { ...pendingInviteRow, revokedAt: new Date('2025-02-01') };
		// 1: invite lookup, 2: requireWishlistRow (recipient = manager, no mod query)
		mockGetDb.mockReturnValue(createMockDb([[revokedInvite], [activeWishlistRow]]));

		await expect(
			callRevokeModeratorInvite(recipientAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});
});

// ── removeModerator ──────────────────────────────────────────────────────────

describe('removeModerator', () => {
	it('recipient removes a moderator on a self list → succeeds (orphan guard exempt)', async () => {
		// 1: assignment lookup, 2: requireWishlistRow (recipient = manager, no mod query),
		// assertNotLastManager returns early (recipientUserId set → no count query), 3: soft-delete update
		mockGetDb.mockReturnValue(createMockDb([[activeAssignmentRow], [activeWishlistRow], []]));

		const result = await callRemoveModerator(recipientAuthContext, {
			assignmentId: testAssignmentId,
		});

		expect(result).toBeUndefined();
	});

	it('assignment not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callRemoveModerator(recipientAuthContext, { assignmentId: 'nonexistent-id' }),
		).rejects.toMatchObject({ status: 404, message: 'MODERATOR_NOT_FOUND' });
	});

	it('orphan guard: removing the last správce on a for-someone list → throws 403 CANNOT_REMOVE_LAST_MANAGER', async () => {
		// The sole moderator (regularUser) tries to remove themselves from a list with no linked recipient.
		// 1: assignment lookup, 2: requireWishlistRow (for-someone), 3: hasActiveModeratorAssignment → found,
		// 4: countActiveModerators → 1 (last one) → guard throws before the soft-delete.
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeAssignmentRow],
				[forSomeoneWishlistRow],
				[{ id: 'assignment-1' }],
				[{ value: 1 }],
			]),
		);

		await expect(
			callRemoveModerator(regularAuthContext, { assignmentId: testAssignmentId }),
		).rejects.toMatchObject({ status: 403, message: 'CANNOT_REMOVE_LAST_MANAGER' });
	});

	it('for-someone list with more than one správce → removal is allowed', async () => {
		// 1: assignment lookup, 2: requireWishlistRow (for-someone), 3: hasActiveModeratorAssignment → found,
		// 4: countActiveModerators → 2 (guard passes), 5: soft-delete update.
		mockGetDb.mockReturnValue(
			createMockDb([
				[activeAssignmentRow],
				[forSomeoneWishlistRow],
				[{ id: 'assignment-1' }],
				[{ value: 2 }],
				[],
			]),
		);

		const result = await callRemoveModerator(regularAuthContext, {
			assignmentId: testAssignmentId,
		});

		expect(result).toBeUndefined();
	});
});

// ── selfPromoteToModerator ───────────────────────────────────────────────────

describe('selfPromoteToModerator', () => {
	it('linked recipient promotes self → sets recipientIsModerator and returns success', async () => {
		// 1: requireWishlistRow (recipientUserId === caller), 2: update wishlist, 3: follower select
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [], []]));

		const result = await callSelfPromoteToModerator(recipientAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({ success: true });
	});

	it('non-recipient (not the person the list is for) → throws 403 ACCESS_DENIED', async () => {
		// Self-promote is a recipient-only action; a správce/visitor cannot opt into reservation state.
		// 1: requireWishlistRow (recipientUserId is recipientUser, caller is regularUser)
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow]]));

		await expect(
			callSelfPromoteToModerator(regularAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});

	it('already seeing reservations → throws 400', async () => {
		const alreadyPromotedWishlistRow = { ...activeWishlistRow, recipientIsModerator: true };
		mockGetDb.mockReturnValue(createMockDb([[alreadyPromotedWishlistRow]]));

		await expect(
			callSelfPromoteToModerator(recipientAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'ALREADY_SEEING_RESERVATIONS' });
	});

	it('archived wishlist → throws 400', async () => {
		const archivedWishlistRow = { ...activeWishlistRow, status: 'archived' };
		// 1: requireWishlistRow (recipient match, then archived check throws)
		mockGetDb.mockReturnValue(createMockDb([[archivedWishlistRow]]));

		await expect(
			callSelfPromoteToModerator(recipientAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_SELF_PROMOTE_ON_ARCHIVED' });
	});
});

// ── getModeratorsForWishlist ─────────────────────────────────────────────────

describe('getModeratorsForWishlist', () => {
	it('recipient of a self list sees moderators + pending invites; recipientName null, isForSomeoneElse false', async () => {
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

		// 1: requireWishlistRow (recipient match, no mod query), 2: moderators select, 3: invites select
		mockGetDb.mockReturnValue(createMockDb([[activeWishlistRow], [moderatorRow], [inviteRow]]));

		const result = await callGetModeratorsForWishlist(recipientAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [inviteRow],
			recipientIsModerator: false,
			isForSomeoneElse: false,
			recipientName: null,
		});
	});

	it('a moderator on a for-someone list also sees pending invites; exposes recipientName + isForSomeoneElse', async () => {
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

		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → found,
		// 3: moderators select, 4: invites select (invites now visible to any manager)
		mockGetDb.mockReturnValue(
			createMockDb([
				[forSomeoneWishlistRow],
				[{ id: 'assignment-1' }],
				[moderatorRow],
				[inviteRow],
			]),
		);

		const result = await callGetModeratorsForWishlist(regularAuthContext, testWishlistId);

		expect(result).toEqual({
			moderators: [moderatorRow],
			pendingInvites: [inviteRow],
			recipientIsModerator: false,
			isForSomeoneElse: true,
			recipientName: 'Grandma',
		});
	});

	it('wishlist not found → throws 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callGetModeratorsForWishlist(recipientAuthContext, 'nonexistent-wl'),
		).rejects.toMatchObject({ status: 404, message: 'WISHLIST_NOT_FOUND' });
	});

	it('non-manager (neither recipient nor správce) → throws 403 ACCESS_DENIED', async () => {
		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → empty (not a mod)
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneWishlistRow], []]));

		await expect(
			callGetModeratorsForWishlist(regularAuthContext, testWishlistId),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});
});
