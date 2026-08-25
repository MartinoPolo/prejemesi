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
	singleFlightRefresh: vi.fn(),
}));

// Stubbed rather than left to import the real module: pulling in wishlists.remote.js would also
// pull in its own module-level guardedQuery()/guardedCommand() calls, which this file's narrow
// $lib/server/remote.js mock doesn't cover.
vi.mock('$lib/modules/wishlists/wishlists.remote.js', () => ({
	getMyWishlists: vi.fn(),
	getModeratedWishlists: vi.fn(),
	getFollowedWishlists: vi.fn(),
	getHomeOverview: vi.fn(),
	getWishlistByShortId: vi.fn(),
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
		sharedAt: 'w.sharedAt',
		deletedAt: 'w.deletedAt',
		updatedAt: 'w.updatedAt',
	},
}));

vi.mock('$lib/server/db/claim.schema.js', () => ({
	claimInvite: {
		id: 'ci.id',
		token: 'ci.token',
		wishlistId: 'ci.wishlistId',
		createdByUserId: 'ci.createdByUserId',
		usedByUserId: 'ci.usedByUserId',
		usedAt: 'ci.usedAt',
		revokedAt: 'ci.revokedAt',
		createdAt: 'ci.createdAt',
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
}));

vi.mock('$lib/server/db/follower.schema.js', () => ({
	wishlistFollower: {
		wishlistId: 'wf.wishlistId',
		userId: 'wf.userId',
		unfollowedAt: 'wf.unfollowedAt',
	},
}));

vi.mock('$lib/server/db/gift.schema.js', () => ({
	gift: { id: 'g.id', wishlistId: 'g.wishlistId', deletedAt: 'g.deletedAt' },
	reservation: {
		id: 'r.id',
		giftId: 'r.giftId',
		userId: 'r.userId',
		deletedAt: 'r.deletedAt',
	},
}));

vi.mock('$lib/server/db/auth.schema.js', () => ({
	user: { id: 'u.id', name: 'u.name', image: 'u.image', email: 'u.email' },
}));

import {
	getClaimInvitesForWishlist,
	generateClaimInviteLink,
	acceptClaimInvite,
	revokeClaimInvite,
} from './claim.remote.js';
import { getDb } from '$lib/server/db/index.js';
import { dispatchNotification } from '$lib/modules/notifications/notification_dispatcher.js';

const mockGetDb = vi.mocked(getDb);
const mockDispatchNotification = vi.mocked(dispatchNotification);

/**
 * Mock database whose chained query methods resolve to sequential entries from
 * queryResults. Each awaited chain (including inside a transaction) consumes one entry.
 */
const transactionSetPayloads: Record<string, unknown>[] = [];

function createMockDb(queryResults: unknown[][]): ReturnType<typeof getDb> {
	let queryIndex = 0;

	const createChain = (insideTransaction = false): unknown =>
		new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (prop === 'then') {
						const result = queryResults[queryIndex] ?? [];
						queryIndex++;
						return (resolve: (value: unknown) => void) => resolve(result);
					}
					if (prop === 'set') {
						return vi.fn((payload: Record<string, unknown>) => {
							if (insideTransaction) {
								transactionSetPayloads.push(payload);
							}
							return createChain(insideTransaction);
						});
					}
					return vi.fn(() => createChain(insideTransaction));
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
				select: vi.fn(() => createChain(true)),
				insert: vi.fn(() => createChain(true)),
				update: vi.fn(() => createChain(true)),
				delete: vi.fn(() => createChain(true)),
			};
			return callback(txProxy);
		}),
	} as unknown as ReturnType<typeof getDb>;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const janaUser = { id: 'jana-1', name: 'Jana', email: 'jana@example.com' };
const evaUser = { id: 'eva-1', name: 'Eva', email: 'eva@example.com' };

const janaAuthContext = { user: janaUser };
const evaAuthContext = { user: evaUser };

const testWishlistId = 'wl-klara';
const testShortId = 'klarawl1';
const testToken = 'claim-tok-abc';
const testInviteId = 'ci-abc';

/** For-someone list (free-text recipient „Klára"), shared, správce = Jana. */
const forSomeoneShared = {
	id: testWishlistId,
	recipientUserId: null,
	recipientName: 'Klára',
	recipientIsModerator: false,
	shortId: testShortId,
	title: 'Klářin seznam',
	status: 'active',
	sharedAt: new Date('2026-06-22T09:00:00Z'),
	deletedAt: null,
};

/** Same list before sharing (guard 1 does not apply). */
const forSomeoneDraft = { ...forSomeoneShared, status: 'draft', sharedAt: null };

/** Archived for-someone list. */
const forSomeoneArchived = { ...forSomeoneShared, status: 'archived' };

/** A linked (self) list — nothing to claim. */
const linkedWishlist = {
	...forSomeoneShared,
	recipientUserId: 'martin-1',
	recipientName: null,
};

const pendingClaimInviteRow = {
	id: testInviteId,
	token: testToken,
	wishlistId: testWishlistId,
	createdByUserId: janaUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2026-06-23T09:00:00Z'),
};

const createdClaimInviteRow = {
	id: 'ci-new',
	token: 'claim-tok-new',
	wishlistId: testWishlistId,
	createdByUserId: janaUser.id,
	usedByUserId: null,
	usedAt: null,
	revokedAt: null,
	createdAt: new Date('2026-06-24T09:00:00Z'),
};

// ── Helper wrappers (bypass TS signature enforcement on mocked functions) ────

const callGetClaimInvitesForWishlist = (authContext: typeof janaAuthContext, wishlistId: string) =>
	(getClaimInvitesForWishlist as unknown as (...args: unknown[]) => unknown)(
		authContext,
		wishlistId,
	);

const callGenerateClaimInviteLink = (
	authContext: typeof janaAuthContext,
	input: { wishlistId: string; email?: string },
) => (generateClaimInviteLink as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callAcceptClaimInvite = (authContext: typeof evaAuthContext, input: { token: string }) =>
	(acceptClaimInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

const callRevokeClaimInvite = (authContext: typeof janaAuthContext, input: { inviteId: string }) =>
	(revokeClaimInvite as unknown as (...args: unknown[]) => unknown)(authContext, input);

beforeEach(() => {
	vi.clearAllMocks();
	transactionSetPayloads.length = 0;
});

// ── generateClaimInviteLink (generation gating) ──────────────────────────────

describe('generateClaimInviteLink', () => {
	it('správce of a for-someone list generates a claim link (no email)', async () => {
		// 1: requireWishlistRow, 2: hasActiveModeratorAssignment (Jana) → found, 3: insert → created
		mockGetDb.mockReturnValue(
			createMockDb([[forSomeoneShared], [{ id: 'assignment-1' }], [createdClaimInviteRow]]),
		);

		const result = await callGenerateClaimInviteLink(janaAuthContext, {
			wishlistId: testWishlistId,
		});

		expect(result).toEqual({
			token: createdClaimInviteRow.token,
			claimPath: `/w/${testShortId}/claim/${createdClaimInviteRow.token}`,
			unregisteredInvitee: false,
		});
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('rejects generation on a linked-recipient list', async () => {
		// caller IS the linked recipient → verifyManagerAccess passes with 1 query, then linked check throws
		mockGetDb.mockReturnValue(
			createMockDb([[{ ...linkedWishlist, recipientUserId: janaUser.id }]]),
		);

		await expect(
			callGenerateClaimInviteLink(janaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_NOT_FOR_LINKED_RECIPIENT' });
	});

	it('rejects generation on an archived list', async () => {
		// 1: requireWishlistRow (for-someone), 2: hasActiveModeratorAssignment → found, then archived check throws
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneArchived], [{ id: 'assignment-1' }]]));

		await expect(
			callGenerateClaimInviteLink(janaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});

	it('non-manager cannot generate → 403 ACCESS_DENIED', async () => {
		// 1: requireWishlistRow (for-someone), 2: hasActiveModeratorAssignment → none (Eva not a správce)
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneShared], []]));

		await expect(
			callGenerateClaimInviteLink(evaAuthContext, { wishlistId: testWishlistId }),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});

	it('with email → dispatches CLAIM_INVITED with the claim path as urlPathOverride', async () => {
		const testEmail = 'klara@example.com';
		// 1: requireWishlistRow, 2: mod assignment → found, 3: insert → created, 4: user lookup → none
		mockGetDb.mockReturnValue(
			createMockDb([
				[forSomeoneShared],
				[{ id: 'assignment-1' }],
				[createdClaimInviteRow],
				[],
			]),
		);

		const result = await callGenerateClaimInviteLink(janaAuthContext, {
			wishlistId: testWishlistId,
			email: testEmail,
		});

		const expectedClaimPath = `/w/${testShortId}/claim/${createdClaimInviteRow.token}`;
		expect(result).toEqual({
			token: createdClaimInviteRow.token,
			claimPath: expectedClaimPath,
			unregisteredInvitee: true,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'claim_invited',
			targetEmails: [testEmail],
			wishlistId: testWishlistId,
			actorId: janaUser.id,
			actorName: janaUser.name,
			urlPathOverride: expectedClaimPath,
		});
	});
});

// ── acceptClaimInvite (claim transaction + guards) ───────────────────────────

describe('acceptClaimInvite', () => {
	it('valid claim on a shared list → links claimer, clears name, notifies správci', async () => {
		// 1: invite, 2: wishlist, 3: guard1 assignment history → none, 4: guard2 reservations → none,
		// 5: managers → [Jana], 6-8: tx updates (invite, wishlist, assignment)
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[], // no prior assignment for Eva
				[], // no active reservations
				[{ userId: janaUser.id }],
				[], // tx: mark invite used
				[], // tx: link wishlist
				[], // tx: soft-delete claimer assignment (none)
				[], // tx: soft-delete claimer follower row
			]),
		);

		const result = await callAcceptClaimInvite(evaAuthContext, { token: testToken });

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: testShortId,
			wishlistTitle: forSomeoneShared.title,
		});
		expect(mockDispatchNotification).toHaveBeenCalledOnce();
		expect(transactionSetPayloads).toEqual(
			expect.arrayContaining([expect.objectContaining({ unfollowedAt: expect.any(Date) })]),
		);
		expect(mockDispatchNotification).toHaveBeenCalledWith({
			type: 'recipient_claimed',
			targetUserIds: [janaUser.id],
			wishlistId: testWishlistId,
			actorId: evaUser.id,
			actorName: evaUser.name,
		});
	});

	it('guard 1: shared list + claimer ever held správce access (revoked row) → rejected', async () => {
		// 1: invite, 2: wishlist (shared), 3: guard1 assignment history → a row exists (even soft-deleted)
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[{ id: 'revoked-assignment' }],
			]),
		);

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_EX_MANAGER' });
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('guard 1 is skipped on a never-shared list: active správce may claim, assignment revoked', async () => {
		// sharedAt null → no guard1 query. 1: invite, 2: wishlist (draft), 3: guard2 reservations → none,
		// 4: managers → [Jana(claimer)], 5-7: tx updates
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneDraft],
				[], // no active reservations
				[{ userId: janaUser.id }], // Jana is the sole active správce and also the claimer
				[], // tx: mark invite used
				[], // tx: link wishlist
				[], // tx: soft-delete claimer's own assignment
				[], // tx: soft-delete claimer follower row
			]),
		);

		const result = await callAcceptClaimInvite(janaAuthContext, { token: testToken });

		expect(result).toEqual({
			wishlistId: testWishlistId,
			wishlistShortId: testShortId,
			wishlistTitle: forSomeoneDraft.title,
		});
		// The only active správce is the claimer, filtered out → no one to notify.
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'recipient_claimed', targetUserIds: [] }),
		);
	});

	it('guard 2: claimer holds active reservations → rejected', async () => {
		// 1: invite, 2: wishlist (shared), 3: guard1 → none, 4: guard2 reservations → a row exists
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[], // no prior assignment
				[{ id: 'reservation-1' }], // active reservation
			]),
		);

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_HAS_RESERVATIONS' });
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('already-linked list → rejected', async () => {
		mockGetDb.mockReturnValue(createMockDb([[pendingClaimInviteRow], [linkedWishlist]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CLAIM_ALREADY_LINKED' });
	});

	it('invite not found → 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: 'nope' }),
		).rejects.toMatchObject({ status: 404, message: 'INVITE_NOT_FOUND' });
	});

	it('revoked invite → 400', async () => {
		const revoked = { ...pendingClaimInviteRow, revokedAt: new Date('2026-06-24T00:00:00Z') };
		mockGetDb.mockReturnValue(createMockDb([[revoked]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_REVOKED' });
	});

	it('already-used invite → 400', async () => {
		const used = {
			...pendingClaimInviteRow,
			usedAt: new Date('2026-06-24T00:00:00Z'),
			usedByUserId: evaUser.id,
		};
		mockGetDb.mockReturnValue(createMockDb([[used]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'INVITE_ALREADY_USED' });
	});

	it('archived wishlist → 400', async () => {
		mockGetDb.mockReturnValue(createMockDb([[pendingClaimInviteRow], [forSomeoneArchived]]));

		await expect(
			callAcceptClaimInvite(evaAuthContext, { token: testToken }),
		).rejects.toMatchObject({ status: 400, message: 'CANNOT_INVITE_ON_ARCHIVED' });
	});
});

// ── revokeClaimInvite ────────────────────────────────────────────────────────

describe('revokeClaimInvite', () => {
	it('manager revokes a pending claim link → succeeds', async () => {
		// 1: invite lookup, 2: requireWishlistRow (for-someone), 3: hasActiveModeratorAssignment → found, 4: update
		mockGetDb.mockReturnValue(
			createMockDb([
				[pendingClaimInviteRow],
				[forSomeoneShared],
				[{ id: 'assignment-1' }],
				[],
			]),
		);

		const result = await callRevokeClaimInvite(janaAuthContext, { inviteId: testInviteId });
		expect(result).toBeUndefined();
	});

	it('non-manager cannot revoke → 403 ACCESS_DENIED', async () => {
		// 1: invite lookup, 2: requireWishlistRow, 3: hasActiveModeratorAssignment → none
		mockGetDb.mockReturnValue(createMockDb([[pendingClaimInviteRow], [forSomeoneShared], []]));

		await expect(
			callRevokeClaimInvite(evaAuthContext, { inviteId: testInviteId }),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});

	it('invite not found → 404', async () => {
		mockGetDb.mockReturnValue(createMockDb([[]]));

		await expect(
			callRevokeClaimInvite(janaAuthContext, { inviteId: 'nope' }),
		).rejects.toMatchObject({ status: 404, message: 'INVITE_NOT_FOUND' });
	});
});

// ── getClaimInvitesForWishlist ───────────────────────────────────────────────

describe('getClaimInvitesForWishlist', () => {
	it('manager sees pending claim invites + isForSomeoneElse true + recipientName', async () => {
		const inviteRow = {
			id: testInviteId,
			token: testToken,
			createdAt: pendingClaimInviteRow.createdAt,
			usedAt: null,
			revokedAt: null,
		};
		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → found, 3: invites select
		mockGetDb.mockReturnValue(
			createMockDb([[forSomeoneShared], [{ id: 'assignment-1' }], [inviteRow]]),
		);

		const result = await callGetClaimInvitesForWishlist(janaAuthContext, testWishlistId);

		expect(result).toEqual({
			pendingInvites: [inviteRow],
			isForSomeoneElse: true,
			recipientName: 'Klára',
		});
	});

	it('non-manager → 403 ACCESS_DENIED', async () => {
		// 1: requireWishlistRow (for-someone), 2: resolveWishlistRole mod check → none
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneShared], []]));

		await expect(
			callGetClaimInvitesForWishlist(evaAuthContext, testWishlistId),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});
});
