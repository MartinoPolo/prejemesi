import {
	DB_READY,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	fixtureId,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';

vi.mock('$app/environment', () => ({ dev: false, building: false, browser: false }));

import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { demoEmailAddress } from '$lib/server/demo/constants.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import type { AgentScope } from '$lib/modules/access_tokens/scopes.js';
import { createAccessToken } from './access_tokens.js';
import type { AgentApiRateLimit } from './api.js';
import { handleMcpRequest } from './mcp_server.js';
import { revokeOauthGrant, saveOauthGrant } from './oauth_grants.js';
import {
	OAUTH_TEST_ORIGIN,
	createOauthClientFixture,
	createTestOauthVerifier,
	epochSeconds,
	foreignSigningKey,
	mintOauthAccessToken,
	removeOauthClientFixtures,
} from './oauth.db.test-setup.js';

const MCP_URL = `${OAUTH_TEST_ORIGIN}/mcp`;
const DISCOVERY = `resource_metadata="${OAUTH_TEST_ORIGIN}/.well-known/oauth-protected-resource/mcp", scope="read offline_access"`;
const EVERY_SCOPE = [
	'gifts:write',
	'reservations:write',
	'managers:invite',
	'reservations:identities',
] as const;

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };
const verifier = createTestOauthVerifier();

const JsonRpcResponseSchema = v.object({
	id: v.nullable(v.union([v.string(), v.number()])),
	result: v.optional(v.record(v.string(), v.unknown())),
	error: v.optional(
		v.object({ code: v.number(), message: v.string(), data: v.optional(v.unknown()) }),
	),
});

const ToolResultSchema = v.object({
	isError: v.boolean(),
	structuredContent: v.record(v.string(), v.unknown()),
});

const ToolListSchema = v.object({ tools: v.array(v.object({ name: v.string() })) });

const ProposalBodySchema = v.object({ proposal: v.object({ status: v.string() }) });

async function postMcp(
	message: unknown,
	authorization?: string,
	rateLimit: AgentApiRateLimit = allowingRateLimit,
): Promise<Response> {
	const request = new Request(MCP_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
			...(authorization === undefined ? {} : { authorization }),
		},
		body: JSON.stringify(message),
	});
	return handleMcpRequest(
		{
			request,
			url: new URL(request.url),
			cookies: { get: () => undefined },
			platform: { env: { AGENT_API_RATE_LIMIT: rateLimit } },
		},
		verifier,
	);
}

async function jsonRpcOf(response: Response) {
	return v.parse(JsonRpcResponseSchema, await response.json());
}

async function callTool(authorization: string, name: string, toolArguments = {}) {
	return postMcp(
		{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: toolArguments } },
		authorization,
	);
}

async function toolResult(authorization: string, name: string, toolArguments = {}) {
	const response = await callTool(authorization, name, toolArguments);
	expect(response.status).toBe(200);
	return v.parse(ToolResultSchema, (await jsonRpcOf(response)).result);
}

async function toolNames(authorization: string): Promise<string[]> {
	const response = await postMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, authorization);
	return v
		.parse(ToolListSchema, (await jsonRpcOf(response)).result)
		.tools.map((tool) => tool.name)
		.sort();
}

async function personalAccessToken(
	input: { scopes?: readonly AgentScope[]; wishlistIds?: string[] | null } = {},
) {
	const { value } = await createAccessToken(
		MANAGER_ID,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: input.scopes ?? [],
			wishlistIds: input.wishlistIds ?? null,
		}),
	);
	return `Bearer ${value}`;
}

/** An app the user connected with these grant scopes, and a token issued with `tokenScope`. */
async function connectedApp(
	input: {
		grantScopes?: readonly AgentScope[];
		wishlistIds?: string[] | null;
		tokenScope?: string;
		userId?: string;
		grantedAt?: Date;
	} = {},
) {
	const userId = input.userId ?? MANAGER_ID;
	const clientId = await createOauthClientFixture({ name: 'Claude' });
	const { grantId } = await saveOauthGrant(
		userId,
		clientId,
		{ scopes: input.grantScopes ?? [], wishlistIds: input.wishlistIds ?? null },
		input.grantedAt,
	);
	const tokenFor = (claims: Record<string, unknown> = {}) =>
		`Bearer ${mintOauthAccessToken({
			sub: userId,
			client_id: clientId,
			scope: input.tokenScope ?? 'read offline_access',
			...claims,
		})}`;
	return { clientId, grantId, authorization: tokenFor(), tokenFor };
}

describe.skipIf(!DB_READY)('MCP server with an app’s OAuth access token', () => {
	const demoUserId = fixtureId('mcp-oauth-demo-user');

	beforeAll(async () => {
		await seedFixtureUsers();
		await getDb()
			.insert(user)
			.values({ id: demoUserId, name: 'Demo', email: demoEmailAddress(demoUserId) });
	});

	afterAll(async () => {
		if (DB_READY) {
			await removeOauthClientFixtures();
			await getDb().delete(user).where(eq(user.id, demoUserId));
		}
		await removeFixtureRows();
	});

	it('lets a connected app initialize and call tools', async () => {
		const fixture = await createWishlistFixture();
		const { authorization } = await connectedApp();

		const initialized = await jsonRpcOf(
			await postMcp(
				{
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: { protocolVersion: '2025-06-18' },
				},
				authorization,
			),
		);
		const wishlists = await toolResult(authorization, 'listWishlists');

		expect(initialized.result).toMatchObject({ serverInfo: { name: 'prejemesi' } });
		expect(wishlists.isError).toBe(false);
		expect(JSON.stringify(wishlists.structuredContent)).toContain(fixture.id);
	});

	it('lists every tool to an app, whatever its scopes', async () => {
		const { authorization } = await connectedApp();

		const appTools = await toolNames(authorization);

		expect(appTools).toEqual(
			await toolNames(await personalAccessToken({ scopes: EVERY_SCOPE })),
		);
		expect(appTools.length).toBeGreaterThan(
			(await toolNames(await personalAccessToken())).length,
		);
	});

	it('answers a missing or invalid token with 401 and the discovery challenge', async () => {
		const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
		const { clientId } = await connectedApp();

		const missing = await postMcp(ping);
		const foreign = await postMcp(
			ping,
			`Bearer ${mintOauthAccessToken({ sub: MANAGER_ID, client_id: clientId, scope: 'read' }, foreignSigningKey())}`,
		);

		expect(missing.status).toBe(401);
		expect(missing.headers.get('www-authenticate')).toBe(`Bearer ${DISCOVERY}`);
		expect(foreign.status).toBe(401);
		expect(foreign.headers.get('www-authenticate')).toBe(
			`Bearer error="invalid_token", ${DISCOVERY}`,
		);
	});

	it('stops a still-valid token on the very next call once its grant is revoked', async () => {
		const { grantId, authorization } = await connectedApp();
		const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
		expect((await postMcp(ping, authorization)).status).toBe(200);

		await revokeOauthGrant(MANAGER_ID, grantId);

		const revoked = await postMcp(ping, authorization);
		expect(revoked.status).toBe(401);
		expect(revoked.headers.get('www-authenticate')).toBe(
			`Bearer error="invalid_token", ${DISCOVERY}`,
		);
		expect(await jsonRpcOf(revoked)).toMatchObject({
			error: { data: { code: 'AGENT_TOKEN_REVOKED' } },
		});
	});

	it('keeps a token issued before a revoke revoked after the user connects the app again', async () => {
		const { clientId, grantId, tokenFor } = await connectedApp({
			grantedAt: new Date(Date.now() - 120_000),
		});
		const earlierToken = tokenFor({ iat: epochSeconds() - 60 });
		const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
		expect((await postMcp(ping, earlierToken)).status).toBe(200);

		await revokeOauthGrant(MANAGER_ID, grantId);
		await saveOauthGrant(MANAGER_ID, clientId, { scopes: [], wishlistIds: null });

		expect((await postMcp(ping, earlierToken)).status).toBe(401);
		expect((await postMcp(ping, tokenFor())).status).toBe(200);
	});

	it('restricts an app’s reads exactly like a personal access token with the same grant', async () => {
		const allowed = await createWishlistFixture();
		const other = await createWishlistFixture();
		await createGiftFixture(allowed.id, { name: 'Povolený dárek' });
		const restriction = { wishlistIds: [allowed.id] };
		const token = await personalAccessToken(restriction);
		const { authorization: app } = await connectedApp(restriction);

		for (const [name, toolArguments] of [
			['listWishlists', {}],
			['readWishlistGifts', { wishlistShortId: allowed.shortId }],
			['readWishlistGifts', { wishlistShortId: other.shortId }],
		] as const) {
			expect(await toolResult(app, name, toolArguments), name).toEqual(
				await toolResult(token, name, toolArguments),
			);
		}
		const outside = await toolResult(app, 'readWishlistGifts', {
			wishlistShortId: other.shortId,
		});
		expect(outside).toMatchObject({
			isError: true,
			structuredContent: { error: { code: 'AGENT_WISHLIST_NOT_ALLOWED' } },
		});
		const listed = JSON.stringify(await toolResult(app, 'listWishlists'));
		expect(listed).toContain(allowed.id);
		expect(listed).not.toContain(other.id);
	});

	it.each([
		{
			label: 'the grant lacks',
			grantScopes: ['reservations:write'],
			tokenScope: 'read gifts:write reservations:write offline_access',
			challengedScope: 'read gifts:write reservations:write offline_access',
		},
		{
			label: 'the token lacks',
			grantScopes: ['gifts:write'],
			tokenScope: 'read offline_access',
			challengedScope: 'read gifts:write offline_access',
		},
	] as const)(
		'challenges for a scope $label with 403 insufficient_scope, keeping the scopes it has',
		async ({ grantScopes, tokenScope, challengedScope }) => {
			const fixture = await createWishlistFixture();
			const { authorization } = await connectedApp({ grantScopes, tokenScope });

			const response = await callTool(authorization, 'createGift', {
				wishlistId: fixture.id,
				name: 'Bez oprávnění',
			});

			expect(response.status).toBe(403);
			const challenge = response.headers.get('www-authenticate') ?? '';
			expect(challenge).toMatch(/^Bearer error="insufficient_scope", /);
			expect(challenge).toContain(`scope="${challengedScope}"`);
			expect(challenge).toContain(
				`resource_metadata="${OAUTH_TEST_ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
			);
			expect(await jsonRpcOf(response)).toMatchObject({
				id: 1,
				error: { data: { code: 'AGENT_SCOPE_MISSING' } },
			});
		},
	);

	it('keeps a personal access token’s missing scope a tool error, without a challenge', async () => {
		const fixture = await createWishlistFixture();

		const response = await callTool(await personalAccessToken(), 'createGift', {
			wishlistId: fixture.id,
			name: 'Bez oprávnění',
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('www-authenticate')).toBeNull();
		expect(v.parse(ToolResultSchema, (await jsonRpcOf(response)).result)).toMatchObject({
			isError: true,
			structuredContent: { error: { code: 'AGENT_SCOPE_MISSING' } },
		});
	});

	it('never fast-forwards an app’s change: it waits for review', async () => {
		const fixture = await createWishlistFixture();
		const { authorization } = await connectedApp({
			grantScopes: ['gifts:write'],
			tokenScope: 'read gifts:write offline_access',
		});

		const result = await toolResult(authorization, 'createGift', {
			wishlistId: fixture.id,
			name: 'Dárek z aplikace',
		});

		expect(v.parse(ProposalBodySchema, result.structuredContent).proposal.status).toBe(
			'pending',
		);
		const names = await getDb()
			.select({ name: gift.name })
			.from(gift)
			.where(eq(gift.wishlistId, fixture.id));
		expect(names).toEqual([]);
	});

	it('limits an app’s requests per grant, apart from personal access tokens', async () => {
		const { grantId, authorization } = await connectedApp();
		const limitedKeys: string[] = [];
		const exhausted: AgentApiRateLimit = {
			limit: async ({ key }) => {
				limitedKeys.push(key);
				return { success: false };
			},
		};

		const response = await postMcp(
			{ jsonrpc: '2.0', id: 1, method: 'ping' },
			authorization,
			exhausted,
		);

		expect(response.status).toBe(429);
		expect(limitedKeys).toEqual([`oauth:${grantId}`]);
	});

	it('refuses an app’s token for a demo identity', async () => {
		const { authorization } = await connectedApp({ userId: demoUserId });

		const response = await postMcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, authorization);

		expect(response.status).toBe(403);
		expect(await jsonRpcOf(response)).toMatchObject({
			error: { data: { code: 'AGENT_DEMO_NOT_ALLOWED' } },
		});
	});
});
