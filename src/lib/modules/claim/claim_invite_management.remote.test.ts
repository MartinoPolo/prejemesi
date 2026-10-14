import { describe, expect, it } from 'vitest';
import {
	mockGetDb,
	createMockDb,
	janaAuthContext,
	evaAuthContext,
	testWishlistId,
	testToken,
	testInviteId,
	forSomeoneShared,
	pendingClaimInviteRow,
	callGetClaimInvitesForWishlist,
	callRevokeClaimInvite,
} from './claim.remote.test-fixtures.js';

describe('revokeClaimInvite', () => {
	it('manager revokes a pending claim link → succeeds', async () => {
		// 1: locked invite, 2: locked wishlist (for-someone), 3: správce assignment → found, 4: update
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
		// 1: locked invite, 2: locked wishlist, 3: správce assignment → none
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
		// 1: wishlist lookup (for-someone), 2: správce assignment → found, 3: invites select
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
		// 1: wishlist lookup (for-someone), 2: správce assignment → none
		mockGetDb.mockReturnValue(createMockDb([[forSomeoneShared], []]));

		await expect(
			callGetClaimInvitesForWishlist(evaAuthContext, testWishlistId),
		).rejects.toMatchObject({ status: 403, message: 'ACCESS_DENIED' });
	});
});
