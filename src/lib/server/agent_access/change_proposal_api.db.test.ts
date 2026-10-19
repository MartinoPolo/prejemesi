import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	SECOND_RESERVER_ID,
	createGiftFixture,
	createWishlistFixture,
	fixtureId,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { getDb } from '$lib/server/db/index.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { user } from '$lib/server/db/auth.schema.js';
import { createAccessToken } from './access_tokens.js';
import { AGENT_CREDENTIAL_KIND, type AgentCredential } from './agent_caller.js';
import { claimIdempotencyKey, fingerprintRequest } from './idempotency.js';
import type { AgentApiRateLimit } from './api.js';
import { AGENT_BATCH_MAX_ITEMS, AGENT_DAILY_CHANGE_BUDGET } from './limits.js';
import { POST as postProposal } from '../../../routes/api/v1/proposals/+server.js';
import { GET as getProposal } from '../../../routes/api/v1/proposals/[proposalId]/+server.js';

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

interface ProposalRequest {
	authorization: string;
	idempotencyKey?: string;
}

function apiEvent(
	path: string,
	init: { method: 'GET' | 'POST'; headers: Headers; body?: string },
	params: Record<string, string>,
) {
	return {
		request: new Request(`https://prejemesi.cz${path}`, init),
		url: new URL(`https://prejemesi.cz${path}`),
		params,
		cookies: { get: () => undefined },
		platform: { env: { AGENT_API_RATE_LIMIT: allowingRateLimit } },
	};
}

type RouteHandler = (event: ReturnType<typeof apiEvent>) => Promise<Response>;

/** The route handlers take a whole SvelteKit event; they read only what `apiEvent` provides. */
function route(handler: unknown): RouteHandler {
	return handler as RouteHandler;
}

async function callSubmit(body: unknown, request: ProposalRequest) {
	const headers = new Headers({
		authorization: request.authorization,
		'content-type': 'application/json',
	});
	if (request.idempotencyKey !== undefined) {
		headers.set('idempotency-key', request.idempotencyKey);
	}
	return route(postProposal)(
		apiEvent('/api/v1/proposals', { method: 'POST', headers, body: JSON.stringify(body) }, {}),
	);
}

async function callRead(proposalId: string, authorization: string) {
	return route(getProposal)(
		apiEvent(
			`/api/v1/proposals/${proposalId}`,
			{ method: 'GET', headers: new Headers({ authorization }) },
			{ proposalId },
		),
	);
}

async function errorOf(response: Response) {
	const body = (await response.json()) as { error: Record<string, unknown> };
	return { status: response.status, ...body.error };
}

interface SubmittedProposal {
	id: string;
	status: string;
	wishlistShortId: string | null;
	reviewUrl: string | null;
	rows: { rowId: string; status: string; result: unknown }[];
}

async function proposalOf(response: Response): Promise<SubmittedProposal> {
	expect(response.status).toBe(201);
	return ((await response.json()) as { proposal: SubmittedProposal }).proposal;
}

async function tokenWithCredential(userId: string, input: Record<string, unknown> = {}) {
	const { value, token } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: ['gifts:write'],
			wishlistIds: null,
			...input,
		}),
	);
	const credential: AgentCredential = {
		kind: AGENT_CREDENTIAL_KIND.personalAccessToken,
		id: token.id,
		prefix: token.prefix,
		expiresAt: token.expiresAt,
	};
	return { authorization: `Bearer ${value}`, credential };
}

async function tokenFor(userId: string, input: Record<string, unknown> = {}) {
	return (await tokenWithCredential(userId, input)).authorization;
}

async function proposalCount(submitterUserId: string) {
	const rows = await getDb()
		.select({ id: changeProposal.id })
		.from(changeProposal)
		.where(eq(changeProposal.submitterUserId, submitterUserId));
	return rows.length;
}

describe.skipIf(!DB_READY)('POST /api/v1/proposals', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);

	it('stores a pending proposal and answers with its rows and review path', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id, { name: 'Kolo' });
		const authorization = await tokenFor(MANAGER_ID);

		const proposal = await proposalOf(
			await callSubmit(
				{
					wishlistShortId: target.shortId,
					operations: [
						{ operation: 'updateGift', input: { id: giftId, name: 'Horské kolo' } },
					],
				},
				{ authorization },
			),
		);

		expect(proposal).toMatchObject({
			status: 'pending',
			wishlistShortId: target.shortId,
			reviewUrl: `/w/${target.shortId}/changes/${proposal.id}`,
			rows: [{ rowId: 'r1', status: 'ready' }],
		});
		expect((await readGift(giftId)).name).toBe('Kolo');
		const read = await callRead(proposal.id, authorization);
		expect(read.status).toBe(200);
		expect(((await read.json()) as { proposal: SubmittedProposal }).proposal.id).toBe(
			proposal.id,
		);
	});

	it('hides a proposal from other users and from a token restricted to other wishlists', async () => {
		const target = await createWishlistFixture();
		const otherWishlist = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const authorization = await tokenFor(MANAGER_ID);
		const proposal = await proposalOf(
			await callSubmit(
				{
					wishlistShortId: target.shortId,
					operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Jiné' } }],
				},
				{ authorization },
			),
		);

		expect(
			await errorOf(await callRead(proposal.id, await tokenFor(RECIPIENT_ID))),
		).toMatchObject({ status: 404, code: SERVER_ERROR.AGENT_PROPOSAL_NOT_FOUND });
		const restricted = await tokenFor(MANAGER_ID, { wishlistIds: [otherWishlist.id] });
		expect(await errorOf(await callRead(proposal.id, restricted))).toMatchObject({
			status: 403,
			code: SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED,
		});
	});

	it('rejects more rows than the batch maximum with that maximum', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const authorization = await tokenFor(MANAGER_ID);
		const operations = Array.from({ length: AGENT_BATCH_MAX_ITEMS + 1 }, (_, index) => ({
			operation: 'updateGift',
			input: { id: giftId, name: `Název ${index}` },
		}));

		const response = await callSubmit(
			{ wishlistShortId: target.shortId, operations },
			{
				authorization,
			},
		);

		expect(await errorOf(response)).toMatchObject({
			status: 400,
			code: SERVER_ERROR.AGENT_BATCH_TOO_LARGE,
			maxItems: AGENT_BATCH_MAX_ITEMS,
		});
	});

	it('answers 429 with when to retry once the daily change budget is spent', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const authorization = await tokenFor(SECOND_RESERVER_ID);
		const spentAt = new Date(Date.now() - 60 * 60 * 1000);
		await getDb()
			.insert(changeProposal)
			.values({
				wishlistId: null,
				submitterUserId: SECOND_RESERVER_ID,
				channel: 'token:Claude',
				tokenName: 'Claude',
				grant: { scopes: ['gifts:write'], wishlistIds: null },
				status: 'discarded',
				rows: [],
				rowCount: AGENT_DAILY_CHANGE_BUDGET.rows,
				createdAt: spentAt,
				expiresAt: new Date(spentAt.getTime() + AGENT_DAILY_CHANGE_BUDGET.windowMs),
				discardedAt: spentAt,
			});

		const response = await callSubmit(
			{
				wishlistShortId: target.shortId,
				operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Jiné' } }],
			},
			{ authorization },
		);

		const expectedRetrySeconds = AGENT_DAILY_CHANGE_BUDGET.windowMs / 1000 - 60 * 60;
		const retryAfter = Number(response.headers.get('retry-after'));
		expect(retryAfter).toBeGreaterThan(expectedRetrySeconds - 60);
		expect(retryAfter).toBeLessThanOrEqual(expectedRetrySeconds);
		expect(await errorOf(response)).toMatchObject({
			status: 429,
			code: SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED,
			retryAfterSeconds: retryAfter,
			budgetRows: AGENT_DAILY_CHANGE_BUDGET.rows,
		});
		expect(await proposalCount(SECOND_RESERVER_ID)).toBe(1);
	});

	describe('daily change budget boundary', () => {
		async function budgetUser(usedRows: number, usedAt: Date) {
			const userId = fixtureId('budget-user');
			await getDb()
				.insert(user)
				.values({ id: userId, name: 'Budget', email: `${userId}@example.com` });
			await getDb()
				.insert(changeProposal)
				.values({
					wishlistId: null,
					submitterUserId: userId,
					channel: 'token:Claude',
					tokenName: 'Claude',
					grant: { scopes: ['gifts:write'], wishlistIds: null },
					status: 'discarded',
					rows: [],
					rowCount: usedRows,
					createdAt: usedAt,
					expiresAt: new Date(usedAt.getTime() + AGENT_DAILY_CHANGE_BUDGET.windowMs),
					discardedAt: usedAt,
				});
			return tokenFor(userId);
		}

		async function submitRows(authorization: string, rowCount: number) {
			const target = await createWishlistFixture();
			const giftId = await createGiftFixture(target.id);
			return callSubmit(
				{
					wishlistShortId: target.shortId,
					operations: Array.from({ length: rowCount }, (_, index) => ({
						operation: 'updateGift',
						input: { id: giftId, name: `Název ${index}` },
					})),
				},
				{ authorization },
			);
		}

		const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

		it('accepts the request that uses the budget up exactly', async () => {
			const authorization = await budgetUser(AGENT_DAILY_CHANGE_BUDGET.rows - 1, hourAgo());

			expect((await submitRows(authorization, 1)).status).toBe(201);
		});

		it('refuses a request one row over the budget', async () => {
			const authorization = await budgetUser(AGENT_DAILY_CHANGE_BUDGET.rows - 1, hourAgo());

			expect(await errorOf(await submitRows(authorization, 2))).toMatchObject({
				status: 429,
				code: SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED,
			});
		});

		it('no longer counts rows submitted before the trailing window', async () => {
			const authorization = await budgetUser(
				AGENT_DAILY_CHANGE_BUDGET.rows,
				new Date(Date.now() - AGENT_DAILY_CHANGE_BUDGET.windowMs - 60 * 1000),
			);

			expect((await submitRows(authorization, 1)).status).toBe(201);
		});
	});

	it('answers 409 while the first request with the same Idempotency-Key still runs', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const { authorization, credential } = await tokenWithCredential(MANAGER_ID);
		const body = {
			wishlistShortId: target.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Souběžně' } }],
		};
		await claimIdempotencyKey({
			credential,
			key: 'running-1',
			fingerprint: await fingerprintRequest('POST', '/api/v1/proposals', body),
		});

		const response = await callSubmit(body, { authorization, idempotencyKey: 'running-1' });

		expect(await errorOf(response)).toMatchObject({
			status: 409,
			code: SERVER_ERROR.AGENT_IDEMPOTENCY_IN_PROGRESS,
		});
		expect((await readGift(giftId)).name).not.toBe('Souběžně');
	});

	it('frees the Idempotency-Key of a refused request for the corrected retry', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const otherGiftId = await createGiftFixture((await createWishlistFixture()).id);
		const authorization = await tokenFor(MANAGER_ID);

		const refused = await callSubmit(
			{
				wishlistShortId: target.shortId,
				operations: [
					{ operation: 'updateGift', input: { id: otherGiftId, name: 'Jinde' } },
				],
			},
			{ authorization, idempotencyKey: 'corrected-1' },
		);
		const corrected = await callSubmit(
			{
				wishlistShortId: target.shortId,
				operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Správně' } }],
			},
			{ authorization, idempotencyKey: 'corrected-1' },
		);

		expect(refused.status).toBe(400);
		expect((await proposalOf(corrected)).rows).toMatchObject([
			{ rowId: 'r1', status: 'ready' },
		]);
		expect(corrected.headers.get('idempotent-replayed')).toBeNull();
	});

	it('replays the stored proposal for a retried Idempotency-Key and rejects reusing it', async () => {
		const target = await createWishlistFixture();
		const giftId = await createGiftFixture(target.id);
		const authorization = await tokenFor(RECIPIENT_ID);
		const body = {
			wishlistShortId: target.shortId,
			operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Jednou' } }],
		};
		const before = await proposalCount(RECIPIENT_ID);

		const first = await callSubmit(body, { authorization, idempotencyKey: 'retry-1' });
		const firstProposal = await proposalOf(first);
		const replay = await callSubmit(body, { authorization, idempotencyKey: 'retry-1' });
		const replayedProposal = await proposalOf(replay);

		expect(replay.headers.get('idempotent-replayed')).toBe('true');
		expect(first.headers.get('idempotent-replayed')).toBeNull();
		expect(replayedProposal).toEqual(firstProposal);
		expect(await proposalCount(RECIPIENT_ID)).toBe(before + 1);
		const reused = await callSubmit(
			{
				...body,
				operations: [{ operation: 'updateGift', input: { id: giftId, name: 'Jinak' } }],
			},
			{ authorization, idempotencyKey: 'retry-1' },
		);
		expect(await errorOf(reused)).toMatchObject({
			status: 422,
			code: SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_REUSED,
		});
		expect(await proposalCount(RECIPIENT_ID)).toBe(before + 1);
	});

	it('rejects a malformed Idempotency-Key with its maximum length', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID);

		const response = await callSubmit(
			{ wishlistShortId: target.shortId, operations: [] },
			{ authorization, idempotencyKey: 'has space' },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 400,
			code: SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_INVALID,
			maxLength: 255,
		});
	});

	it('refuses reads in a proposal', async () => {
		const target = await createWishlistFixture();
		const authorization = await tokenFor(MANAGER_ID, { scopes: ['read', 'gifts:write'] });

		const response = await callSubmit(
			{
				wishlistShortId: target.shortId,
				operations: [
					{ operation: 'readWishlistGifts', input: { wishlistShortId: target.shortId } },
				],
			},
			{ authorization },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 400,
			code: SERVER_ERROR.AGENT_PROPOSAL_NOT_A_CHANGE,
		});
	});

	it('refuses a row that changes a different wishlist than the proposal’s', async () => {
		const target = await createWishlistFixture();
		const otherWishlist = await createWishlistFixture();
		const otherGiftId = await createGiftFixture(otherWishlist.id);
		const authorization = await tokenFor(MANAGER_ID);

		const response = await callSubmit(
			{
				wishlistShortId: target.shortId,
				operations: [
					{ operation: 'updateGift', input: { id: otherGiftId, name: 'Jinde' } },
				],
			},
			{ authorization },
		);

		expect(await errorOf(response)).toMatchObject({
			status: 400,
			code: SERVER_ERROR.AGENT_PROPOSAL_WISHLIST_MISMATCH,
			rowId: 'r1',
		});
	});

	describe('wishlist creation', () => {
		const creation = {
			operations: [
				{
					operation: 'createWishlist',
					input: { title: 'Narozeniny', recipientKind: 'other', recipientName: 'Jana' },
				},
			],
		};

		it('is refused without fast-forward', async () => {
			const authorization = await tokenFor(MANAGER_ID, { scopes: ['gifts:write'] });

			expect(await errorOf(await callSubmit(creation, { authorization }))).toMatchObject({
				status: 400,
				code: SERVER_ERROR.AGENT_WISHLIST_CREATION_REQUIRES_FAST_FORWARD,
				rowId: 'r1',
			});
		});

		it('is applied at once for an unrestricted fast-forward token', async () => {
			const authorization = await tokenFor(MANAGER_ID, {
				scopes: ['gifts:write'],
				fastForward: true,
			});

			const proposal = await proposalOf(await callSubmit(creation, { authorization }));

			expect(proposal).toMatchObject({
				status: 'applied',
				wishlistShortId: null,
				reviewUrl: null,
				rows: [{ rowId: 'r1', status: 'applied' }],
			});
			const created = proposal.rows[0]?.result as { id: string };
			const [createdRow] = await getDb()
				.select({ title: wishlist.title })
				.from(wishlist)
				.where(eq(wishlist.id, created.id));
			expect(createdRow?.title).toBe('Narozeniny');
			await getDb().delete(wishlist).where(eq(wishlist.id, created.id));
		});
	});
});
