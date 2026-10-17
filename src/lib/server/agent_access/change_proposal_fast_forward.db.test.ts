import {
	DB_READY,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import type * as ChangeProposalsModule from './change_proposals.js';

vi.mock('./change_proposals.js', async (importOriginal) => ({
	...(await importOriginal<typeof ChangeProposalsModule>()),
	applyChangeProposalRows: vi.fn(async () => {
		throw new Error('Apply failed after the proposal was stored');
	}),
}));

import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { CHANGE_PROPOSAL_STATE } from '$lib/modules/change_proposals/types.js';
import { authenticateAccessToken, createAccessToken } from './access_tokens.js';
import { submitChangeProposal } from './change_proposal_api.js';

async function fastForwardToken() {
	const { value } = await createAccessToken(
		MANAGER_ID,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: ['gifts:write'],
			wishlistIds: null,
			fastForward: true,
		}),
	);
	return authenticateAccessToken(`Bearer ${value}`);
}

describe.skipIf(!DB_READY)('fast-forward that fails after the proposal is stored', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('answers with the stored pending proposal instead of failing the request', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('discards a wishlist-creating proposal, which has no review page', async () => {
		const submitted = await submitChangeProposal(await fastForwardToken(), {
			operations: [
				{
					operation: 'createWishlist',
					input: { title: 'Narozeniny', recipientKind: 'other', recipientName: 'Jana' },
				},
			],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.discarded);
	});
});
