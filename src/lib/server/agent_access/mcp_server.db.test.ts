import {
	DB_READY,
	RECIPIENT_ID,
	RESERVER_EMAIL,
	RESERVER_ID,
	RESERVER_NAME,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	fixtureId,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { getDb } from '$lib/server/db/index.js';
import { demoSession } from '$lib/server/db/auth.schema.js';
import { gift, giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { DEMO_COOKIE_NAME } from '$lib/server/demo/constants.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { createAccessToken } from './access_tokens.js';
import type { AgentApiRateLimit } from './api.js';
import { POST as postMcp } from '../../../routes/mcp/+server.js';

const ORIGIN = 'https://prejemesi.cz';
const MCP_URL = `${ORIGIN}/mcp`;
const ANONYMOUS_GIFTER_EMAIL = 'mcp-teta@example.com';
const LIVE_DEMO_COOKIE = 'c'.repeat(64);
const RESERVATION_AND_LIKE_FIELDS = [
	'likeCount',
	'reservedCount',
	'isFullyReserved',
	'reserverNames',
	'myReservationId',
	'myReservationPurchasedAt',
];
const EVERY_SCOPE = [
	'gifts:write',
	'reservations:write',
	'managers:invite',
	'reservations:identities',
] as const;

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

type McpRoute = (event: {
	request: Request;
	url: URL;
	cookies: { get(name: string): string | undefined };
	platform: { env: { AGENT_API_RATE_LIMIT: AgentApiRateLimit } };
}) => Promise<Response>;

/** The route reads only what this event provides. */
const mcpRoute = postMcp as unknown as McpRoute;

function routeFetch(demoCookie?: string) {
	return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const request = new Request(input, init);
		return mcpRoute({
			request,
			url: new URL(request.url),
			cookies: {
				get: (name) => (name === DEMO_COOKIE_NAME ? demoCookie : undefined),
			},
			platform: { env: { AGENT_API_RATE_LIMIT: allowingRateLimit } },
		});
	};
}

async function tokenValue(userId: string, input: Record<string, unknown> = {}) {
	const { value } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'MCP client',
			scopes: [],
			wishlistIds: null,
			...input,
		}),
	);
	return value;
}

async function connectedClient(token: string) {
	const client = new Client({ name: 'mcp-test-client', version: '1.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(new URL(MCP_URL), {
			fetch: routeFetch(),
			requestInit: { headers: { authorization: `Bearer ${token}` } },
		}),
	);
	return client;
}

async function postRaw(body: unknown, headers: Record<string, string> = {}, demoCookie?: string) {
	return routeFetch(demoCookie)(MCP_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...headers,
		},
		body: JSON.stringify(body),
	});
}

const ToolResultSchema = v.object({
	isError: v.optional(v.boolean()),
	content: v.array(v.object({ type: v.string(), text: v.optional(v.string()) })),
	structuredContent: v.record(v.string(), v.unknown()),
});

const ProposalBodySchema = v.object({
	proposal: v.object({
		id: v.string(),
		status: v.string(),
		reviewUrl: v.nullable(v.string()),
		rows: v.array(v.object({ status: v.string(), operation: v.string() })),
	}),
});

async function callTool(client: Client, name: string, toolArguments: Record<string, unknown>) {
	return v.parse(ToolResultSchema, await client.callTool({ name, arguments: toolArguments }));
}

async function giftNames(wishlistId: string) {
	const rows = await getDb()
		.select({ name: gift.name })
		.from(gift)
		.where(eq(gift.wishlistId, wishlistId));
	return rows.map((row) => row.name);
}

describe.skipIf(!DB_READY)('MCP server', () => {
	const demoSessionId = fixtureId('mcp-demo-session');

	beforeAll(async () => {
		await seedFixtureUsers();
		await getDb()
			.insert(demoSession)
			.values({
				id: demoSessionId,
				tokenHash: createHash('sha256').update(LIVE_DEMO_COOKIE).digest('hex'),
				viewerUserId: fixtureId('mcp-demo-viewer'),
				clientHash: 'test-client',
				expiresAt: new Date(Date.now() + 3_600_000),
			});
	});

	afterAll(async () => {
		if (DB_READY) {
			await getDb().delete(demoSession).where(eq(demoSession.id, demoSessionId));
		}
		await removeFixtureRows();
	});

	it('speaks MCP to the official client: initialize, then tools from the API schemas', async () => {
		const client = await connectedClient(await tokenValue(MANAGER_ID, { scopes: EVERY_SCOPE }));

		expect(client.getServerVersion()).toMatchObject({ name: 'prejemesi' });
		expect(client.getServerCapabilities()).toHaveProperty('tools');
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual(
			expect.arrayContaining([
				'listWishlists',
				'readWishlistGifts',
				'createGift',
				'submitChangeProposal',
			]),
		);
		await client.close();
	});

	it('answers a missing or unknown token with 401 and a bearer challenge', async () => {
		const missing = await postRaw({ jsonrpc: '2.0', id: 1, method: 'ping' });
		const unknown = await postRaw(
			{ jsonrpc: '2.0', id: 1, method: 'ping' },
			{ authorization: `Bearer pjs_${'x'.repeat(43)}` },
		);

		for (const response of [missing, unknown]) {
			expect(response.status).toBe(401);
			expect(response.headers.get('www-authenticate')).toBe('Bearer');
			expect(await response.json()).toMatchObject({
				error: { data: { code: 'AGENT_TOKEN_INVALID' } },
			});
		}
	});

	it('answers notifications with 202 and unknown methods and tools with JSON-RPC errors', async () => {
		const authorization = `Bearer ${await tokenValue(MANAGER_ID)}`;

		const notification = await postRaw(
			{ jsonrpc: '2.0', method: 'notifications/initialized' },
			{ authorization },
		);
		const unknownMethod = await postRaw(
			{ jsonrpc: '2.0', id: 7, method: 'resources/list' },
			{ authorization },
		);
		const unknownTool = await postRaw(
			{ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'shareWishlist' } },
			{ authorization },
		);
		const batch = await postRaw([{ jsonrpc: '2.0', id: 9, method: 'ping' }], { authorization });

		expect(notification.status).toBe(202);
		expect(await unknownMethod.json()).toMatchObject({ id: 7, error: { code: -32601 } });
		expect(await unknownTool.json()).toMatchObject({ id: 8, error: { code: -32602 } });
		expect(batch.status).toBe(400);
	});

	it('rejects a live demo cookie like the API does', async () => {
		const response = await postRaw(
			{ jsonrpc: '2.0', id: 1, method: 'ping' },
			{ authorization: `Bearer ${await tokenValue(MANAGER_ID)}` },
			LIVE_DEMO_COOKIE,
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: { data: { code: 'AGENT_DEMO_NOT_ALLOWED' } },
		});
	});

	it('gives a recipient token’s reads no reservation or like data', async () => {
		const fixture = await createWishlistFixture({ sharedAt: new Date(Date.now() - 3_600_000) });
		const giftId = await createGiftFixture(fixture.id, { quantity: 3 });
		await reserveGift(giftId, RESERVER_ID);
		await getDb()
			.insert(reservation)
			.values({ giftId, anonymousName: 'MCP teta', anonymousEmail: ANONYMOUS_GIFTER_EMAIL });
		await getDb().insert(giftLike).values({ giftId, userId: RESERVER_ID });
		const client = await connectedClient(
			await tokenValue(RECIPIENT_ID, { scopes: EVERY_SCOPE }),
		);

		const giftsResult = await callTool(client, 'readWishlistGifts', {
			wishlistShortId: fixture.shortId,
		});
		const wishlistsResult = await callTool(client, 'listWishlists', {});

		expect(giftsResult.isError).toBe(false);
		const gifts = v.parse(
			v.object({ result: v.object({ gifts: v.array(v.record(v.string(), v.unknown())) }) }),
			giftsResult.structuredContent,
		).result.gifts;
		expect(gifts).toHaveLength(1);
		for (const field of RESERVATION_AND_LIKE_FIELDS) {
			expect(gifts[0]).not.toHaveProperty(field);
		}
		const everything = JSON.stringify([giftsResult, wishlistsResult]);
		for (const identity of [
			RESERVER_NAME,
			RESERVER_EMAIL,
			'MCP teta',
			ANONYMOUS_GIFTER_EMAIL,
		]) {
			expect(everything).not.toContain(identity);
		}
		for (const field of RESERVATION_AND_LIKE_FIELDS) {
			expect(everything).not.toContain(`"${field}"`);
		}
		await client.close();
	});

	it('submits a change tool as a pending proposal with an absolute review link', async () => {
		const fixture = await createWishlistFixture();
		const client = await connectedClient(
			await tokenValue(MANAGER_ID, { scopes: ['gifts:write'] }),
		);

		const result = await callTool(client, 'createGift', {
			wishlistId: fixture.id,
			name: 'Deskovka z MCP',
		});

		expect(result.isError).toBe(false);
		const { proposal } = v.parse(ProposalBodySchema, result.structuredContent);
		expect(proposal.status).toBe('pending');
		expect(proposal.reviewUrl).toBe(`/w/${fixture.shortId}/changes/${proposal.id}`);
		expect(result.content[0]?.text).toContain(
			`${ORIGIN}/w/${fixture.shortId}/changes/${proposal.id}`,
		);
		expect(await giftNames(fixture.id)).not.toContain('Deskovka z MCP');
		await client.close();
	});

	it('applies a fast-forward token’s change at once, but leaves a deletion for the user', async () => {
		const fixture = await createWishlistFixture();
		const existingGiftId = await createGiftFixture(fixture.id);
		const client = await connectedClient(
			await tokenValue(MANAGER_ID, { scopes: ['gifts:write'], fastForward: true }),
		);

		const created = await callTool(client, 'createGift', {
			wishlistId: fixture.id,
			name: 'Rychlý dárek',
		});
		const deleted = await callTool(client, 'deleteGift', { giftId: existingGiftId });

		expect(v.parse(ProposalBodySchema, created.structuredContent).proposal.status).toBe(
			'applied',
		);
		expect(await giftNames(fixture.id)).toContain('Rychlý dárek');
		const deletion = v.parse(ProposalBodySchema, deleted.structuredContent).proposal;
		expect(deletion.status).toBe('pending');
		expect(deletion.rows[0]?.status).toBe('needsConfirmation');
		expect(await giftNames(fixture.id)).toHaveLength(2);
		await client.close();
	});

	it('replays a batch proposal submitted again with the same idempotencyKey', async () => {
		const fixture = await createWishlistFixture();
		const client = await connectedClient(
			await tokenValue(MANAGER_ID, { scopes: ['gifts:write'] }),
		);
		const submission = {
			idempotencyKey: 'mcp-batch-1',
			wishlistShortId: fixture.shortId,
			operations: [
				{ operation: 'createGift', input: { wishlistId: fixture.id, name: 'První' } },
				{ operation: 'createGift', input: { wishlistId: fixture.id, name: 'Druhý' } },
			],
		};

		const first = await callTool(client, 'submitChangeProposal', submission);
		const second = await callTool(client, 'submitChangeProposal', submission);

		const firstProposal = v.parse(ProposalBodySchema, first.structuredContent).proposal;
		expect(firstProposal.rows).toHaveLength(2);
		expect(v.parse(ProposalBodySchema, second.structuredContent).proposal.id).toBe(
			firstProposal.id,
		);
		await client.close();
	});

	it('reports a tool failure as an error result the model can read', async () => {
		const fixture = await createWishlistFixture();
		const client = await connectedClient(await tokenValue(MANAGER_ID));

		const result = await callTool(client, 'createGift', {
			wishlistId: fixture.id,
			name: 'Bez oprávnění',
		});

		expect(result.isError).toBe(true);
		expect(result.structuredContent).toMatchObject({ error: { code: 'AGENT_SCOPE_MISSING' } });
		await client.close();
	});
});
