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
import { eq } from 'drizzle-orm';
import type * as ChangeProposalsModule from './change_proposals.js';

vi.mock('./change_proposals.js', async (importOriginal) => ({
	...(await importOriginal<typeof ChangeProposalsModule>()),
	applyChangeProposalRows: vi.fn(async () => {
		throw new Error('Apply failed after the proposal was stored');
	}),
}));

import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { CHANGE_PROPOSAL_STATE, FAST_FORWARD_HOLD } from '$lib/modules/change_proposals/types.js';
import { authenticateAccessToken, createAccessToken } from './access_tokens.js';
import { applyChangeProposalForAgent, submitChangeProposal } from './change_proposal_api.js';
import { applyChangeProposalRows } from './change_proposals.js';

const { applyChangeProposalRows: realApplyChangeProposalRows } =
	await vi.importActual<typeof ChangeProposalsModule>('./change_proposals.js');

async function agentToken(fastForward: boolean) {
	const { value } = await createAccessToken(
		MANAGER_ID,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: ['gifts:write'],
			wishlistIds: null,
			fastForward,
		}),
	);
	return authenticateAccessToken(`Bearer ${value}`);
}

const fastForwardToken = () => agentToken(true);

async function storedHold(proposalId: string) {
	const [row] = await getDb()
		.select({ fastForwardHold: changeProposal.fastForwardHold })
		.from(changeProposal)
		.where(eq(changeProposal.id, proposalId));
	return row?.fastForwardHold;
}

describe.skipIf(!DB_READY)('fast-forward that fails after the proposal is stored', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('answers with the stored pending proposal instead of failing the request', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		let holdDuringApply: string | null | undefined;
		vi.mocked(applyChangeProposalRows).mockImplementationOnce(async (_reviewer, proposalId) => {
			holdDuringApply = await storedHold(proposalId);
			throw new Error('Request killed mid-apply');
		});

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect(holdDuringApply).toBe(FAST_FORWARD_HOLD.failed);
		expect(submitted.fastForwardHold).toBe(FAST_FORWARD_HOLD.failed);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('names the conflict when a retry finds a gift changed since', async () => {
		const caller = await fastForwardToken();
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		const submitted = await submitChangeProposal(caller, {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});
		await getDb().update(gift).set({ name: 'Mezitím' }).where(eq(gift.id, giftId));

		await expect(applyChangeProposalForAgent(caller, submitted.id)).rejects.toThrow();

		expect(await storedHold(submitted.id)).toBe(FAST_FORWARD_HOLD.conflict);
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
		expect(submitted.fastForwardHold).toBeNull();
	});
});

describe.skipIf(!DB_READY)('why a fast-forward proposal still waits for review', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('applies a proposal of ready rows at once, with no reason to wait', async () => {
		vi.mocked(applyChangeProposalRows).mockImplementationOnce(realApplyChangeProposalRows);
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.applied);
		expect(await storedHold(submitted.id)).toBeNull();
		expect((await readGift(giftId)).name).toBe('Rovnou');
	});

	it('keeps a proposal with a deletion pending because it needs confirmation', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id);

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'deleteGift', input: { giftId } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect(submitted.fastForwardHold).toBe(FAST_FORWARD_HOLD.needsConfirmation);
	});

	it('keeps a proposal with a rejected row pending, naming the rejection', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id);

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [
				{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } },
				{ operation: 'updateGift', input: { id: 'no-such-gift', name: 'Nikde' } },
			],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect(submitted.fastForwardHold).toBe(FAST_FORWARD_HOLD.rejected);
	});

	it('keeps a proposal pending as a conflict when a gift changes before the apply', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		vi.mocked(applyChangeProposalRows).mockImplementationOnce(async (...args) => {
			await getDb().update(gift).set({ name: 'Mezitím' }).where(eq(gift.id, giftId));
			return realApplyChangeProposalRows(...args);
		});

		const submitted = await submitChangeProposal(await fastForwardToken(), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect(submitted.fastForwardHold).toBe(FAST_FORWARD_HOLD.conflict);
		expect((await readGift(giftId)).name).toBe('Mezitím');
	});

	it('gives no reason for a proposal submitted without fast-forward', async () => {
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id);

		const submitted = await submitChangeProposal(await agentToken(false), {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Rovnou' } }],
		});

		expect(submitted.status).toBe(CHANGE_PROPOSAL_STATE.pending);
		expect(submitted.fastForwardHold).toBeNull();
	});
});
