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

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

const applySpy = vi.hoisted(() => ({ failNext: false }));

vi.mock('./change_proposals.js', async (importOriginal) => {
	const original = await importOriginal<typeof ChangeProposalsModule>();
	return {
		...original,
		applyChangeProposalRows: async (
			...parameters: Parameters<typeof original.applyChangeProposalRows>
		) => {
			if (applySpy.failNext) {
				applySpy.failNext = false;
				throw new Error('Apply failed after the proposal was stored');
			}
			return original.applyChangeProposalRows(...parameters);
		},
	};
});

import { getDb } from '$lib/server/db/index.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { eq } from 'drizzle-orm';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { CHANGE_PROPOSAL_STATE } from '$lib/modules/change_proposals/types.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { authenticateAccessToken, createAccessToken } from './access_tokens.js';
import type { AgentApiRateLimit } from './api.js';
import { submitChangeProposal } from './change_proposal_api.js';
import { POST as postApply } from '../../../routes/api/v1/proposals/[proposalId]/apply/+server.js';

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

type ApplyRoute = (event: {
	request: Request;
	url: URL;
	params: { proposalId: string };
	cookies: { get(name: string): string | undefined };
	platform: { env: { AGENT_API_RATE_LIMIT: AgentApiRateLimit } };
}) => Promise<Response>;

/** The route reads only what this event provides. */
const applyRoute = postApply as unknown as ApplyRoute;

async function tokenFor(input: Record<string, unknown>) {
	const { value } = await createAccessToken(
		MANAGER_ID,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'CLI',
			scopes: ['gifts:write'],
			wishlistIds: null,
			...input,
		}),
	);
	return { value, token: await authenticateAccessToken(`Bearer ${value}`) };
}

async function callApply(proposalId: string, tokenValue: string) {
	const url = `https://prejemesi.cz/api/v1/proposals/${proposalId}/apply`;
	const response = await applyRoute({
		request: new Request(url, {
			method: 'POST',
			headers: { authorization: `Bearer ${tokenValue}` },
		}),
		url: new URL(url),
		params: { proposalId },
		cookies: { get: () => undefined },
		platform: { env: { AGENT_API_RATE_LIMIT: allowingRateLimit } },
	});
	return { status: response.status, body: v.parse(ResponseBodySchema, await response.json()) };
}

const ResponseBodySchema = v.object({
	proposal: v.optional(v.object({ id: v.string(), status: v.string() })),
	error: v.optional(
		v.object({ code: v.string(), reviewUrl: v.optional(v.nullable(v.string())) }),
	),
});

async function renamingProposal(token: Awaited<ReturnType<typeof tokenFor>>['token']) {
	const wishlist = await createWishlistFixture();
	const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
	const proposal = await submitChangeProposal(token, {
		wishlistShortId: wishlist.shortId,
		operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Koloběžka' } }],
	});
	return { wishlist, giftId, proposal };
}

describe.skipIf(!DB_READY)('applying a proposal through the API', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('applies a fast-forward proposal that waited because its first apply failed', async () => {
		const { value, token } = await tokenFor({ fastForward: true });
		applySpy.failNext = true;
		const { giftId, proposal } = await renamingProposal(token);
		expect(proposal.status).toBe(CHANGE_PROPOSAL_STATE.pending);

		const applied = await callApply(proposal.id, value);

		expect(applied.status).toBe(200);
		expect(applied.body.proposal).toMatchObject({
			id: proposal.id,
			status: CHANGE_PROPOSAL_STATE.applied,
		});
		expect((await readGift(giftId)).name).toBe('Koloběžka');
	});

	it('leaves a proposal of a token without fast-forward for the user to review', async () => {
		const { value, token } = await tokenFor({});
		const { wishlist, giftId, proposal } = await renamingProposal(token);

		const refused = await callApply(proposal.id, value);

		expect(refused.status).toBe(409);
		expect(refused.body.error).toMatchObject({
			code: SERVER_ERROR.AGENT_PROPOSAL_REVIEW_REQUIRED,
			reviewUrl: `/w/${wishlist.shortId}/changes/${proposal.id}`,
		});
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('lets no other fast-forward token of the same user skip that review', async () => {
		const { token } = await tokenFor({});
		const other = await tokenFor({ fastForward: true });
		const { giftId, proposal } = await renamingProposal(token);

		const refused = await callApply(proposal.id, other.value);

		expect(refused.body.error?.code).toBe(SERVER_ERROR.AGENT_PROPOSAL_REVIEW_REQUIRED);
		expect((await readGift(giftId)).name).toBe('Kolo');
	});

	it('never applies a deletion, which always needs the user’s confirmation', async () => {
		const { value, token } = await tokenFor({ fastForward: true });
		const wishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(wishlist.id);
		const proposal = await submitChangeProposal(token, {
			wishlistShortId: wishlist.shortId,
			operations: [{ operation: 'deleteGift', input: { giftId } }],
		});

		const refused = await callApply(proposal.id, value);

		expect(refused.body.error?.code).toBe(SERVER_ERROR.AGENT_PROPOSAL_REVIEW_REQUIRED);
		const remaining = await getDb().select().from(gift).where(eq(gift.id, giftId));
		expect(remaining).toHaveLength(1);
	});

	it('answers an applied proposal as no longer pending', async () => {
		const { value, token } = await tokenFor({ fastForward: true });
		const { proposal } = await renamingProposal(token);
		expect(proposal.status).toBe(CHANGE_PROPOSAL_STATE.applied);

		const refused = await callApply(proposal.id, value);

		expect(refused.status).toBe(409);
		expect(refused.body.error?.code).toBe(SERVER_ERROR.AGENT_PROPOSAL_NOT_PENDING);
	});
});
