import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	RESERVER_EMAIL,
	RESERVER_ID,
	RESERVER_NAME,
	createGiftFixture,
	createWishlistFixture,
	fixtureId,
	removeFixtureRows,
	reserveGift,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

const applicationEnvironment = vi.hoisted(() => ({ dev: false }));
vi.mock('$app/environment', () => ({
	get dev() {
		return applicationEnvironment.dev;
	},
	building: false,
	browser: false,
}));

import { getDb } from '$lib/server/db/index.js';
import { demoSession, user } from '$lib/server/db/auth.schema.js';
import { giftLike, reservation } from '$lib/server/db/gift.schema.js';
import { moderatorAssignment } from '$lib/server/db/moderator.schema.js';
import { DEMO_COOKIE_NAME, demoEmailAddress } from '$lib/server/demo/constants.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { createAccessToken, revokeAccessToken } from './access_tokens.js';
import {
	AgentApiFailure,
	agentApiEndpoint,
	type AgentApiRateLimit,
	type AgentApiResponse,
} from './api.js';
import { AGENT_API_MAX_BODY_BYTES, AGENT_API_RATE_LIMIT } from './limits.js';
import { authorizeAgentOperations } from './authorization.js';
import { GET as getMe } from '../../../routes/api/v1/me/+server.js';
import { GET as getWishlists } from '../../../routes/api/v1/wishlists/+server.js';
import { POST as postOperation } from '../../../routes/api/v1/operations/[operationName]/+server.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS_GIFTER_NAME = 'Anonymní teta';
const ANONYMOUS_GIFTER_EMAIL = 'teta@example.com';
const RESERVATION_AND_LIKE_FIELDS = [
	'likeCount',
	'reservedCount',
	'isFullyReserved',
	'reserverNames',
	'myReservationId',
	'myReservationPurchasedAt',
];

const allowingRateLimit: AgentApiRateLimit = { limit: async () => ({ success: true }) };

interface ApiRequest {
	authorization?: string;
	body?: string;
	contentType?: string;
	demoCookie?: string;
	/** Null leaves the Workers binding out, as the Vite dev server does. */
	rateLimit?: AgentApiRateLimit | null;
	operationName?: string;
}

function apiEvent(path: string, method: 'GET' | 'POST', request: ApiRequest) {
	const headers = new Headers();
	if (request.authorization !== undefined) {
		headers.set('authorization', request.authorization);
	}
	if (request.body !== undefined) {
		headers.set('content-type', request.contentType ?? 'application/json');
	}
	const rateLimit = request.rateLimit === undefined ? allowingRateLimit : request.rateLimit;
	return {
		request: new Request(
			`https://prejemesi.cz${path}`,
			method === 'GET' ? { method, headers } : { method, headers, body: request.body },
		),
		url: new URL(`https://prejemesi.cz${path}`),
		params: { operationName: request.operationName ?? '' },
		cookies: {
			get: (name: string) => (name === DEMO_COOKIE_NAME ? request.demoCookie : undefined),
		},
		platform: rateLimit === null ? undefined : { env: { AGENT_API_RATE_LIMIT: rateLimit } },
	};
}

type RouteHandler = (event: ReturnType<typeof apiEvent>) => Promise<Response>;

/** The route handlers take a whole SvelteKit event; they read only what `apiEvent` provides. */
function route(handler: unknown): RouteHandler {
	return handler as RouteHandler;
}

async function callMe(request: ApiRequest = {}) {
	return route(getMe)(apiEvent('/api/v1/me', 'GET', request));
}

async function callOperation(operationName: string, input: unknown, request: ApiRequest = {}) {
	return route(postOperation)(
		apiEvent(`/api/v1/operations/${operationName}`, 'POST', {
			body: JSON.stringify(input),
			operationName,
			...request,
		}),
	);
}

async function errorOf(response: Response) {
	const body = (await response.json()) as { error: Record<string, unknown> };
	return { status: response.status, ...body.error };
}

async function tokenFor(userId: string, input: Record<string, unknown> = {}, now?: Date) {
	const { token, value } = await createAccessToken(
		userId,
		v.parse(CreateAccessTokenInputSchema, {
			name: 'Claude',
			scopes: [],
			wishlistIds: null,
			...input,
		}),
		now,
	);
	return { tokenId: token.id, authorization: `Bearer ${value}` };
}

const everyScope = [
	'gifts:write',
	'reservations:write',
	'managers:invite',
	'reservations:identities',
];

describe.skipIf(!DB_READY)('agent API', () => {
	const demoSessionId = fixtureId('demo-session');
	const demoUserId = fixtureId('demo-user');
	const liveDemoCookie = 'd'.repeat(64);

	beforeAll(async () => {
		await seedFixtureUsers();
		await getDb()
			.insert(demoSession)
			.values({
				id: demoSessionId,
				tokenHash: createHash('sha256').update(liveDemoCookie).digest('hex'),
				viewerUserId: demoUserId,
				clientHash: 'test-client',
				expiresAt: new Date(Date.now() + DAY_MS),
			});
		await getDb()
			.insert(user)
			.values({
				id: demoUserId,
				name: 'Demo',
				email: demoEmailAddress(demoUserId),
				demoSessionId,
			});
	});

	afterAll(async () => {
		if (DB_READY) {
			await getDb().delete(user).where(eq(user.id, demoUserId));
			await getDb().delete(demoSession).where(eq(demoSession.id, demoSessionId));
		}
		await removeFixtureRows();
	});

	beforeEach(() => {
		applicationEnvironment.dev = false;
	});

	describe('authentication', () => {
		it('answers the token user and the token, without its hash or value', async () => {
			const fixture = await createWishlistFixture();
			const { authorization } = await tokenFor(MANAGER_ID, {
				name: 'Agent',
				scopes: ['gifts:write'],
				wishlistIds: [fixture.id],
			});

			const response = await callMe({ authorization });

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toMatchObject({
				user: { name: 'Manager' },
				token: {
					name: 'Agent',
					prefix: expect.stringMatching(/^pjs_/),
					scopes: ['read', 'gifts:write'],
					wishlistIds: [fixture.id],
					fastForward: false,
					expiresAt: expect.any(String),
				},
			});
			expect(JSON.stringify(body)).not.toContain(authorization.slice('Bearer '.length));
		});

		it('fails a missing, malformed or unknown token with 401 AGENT_TOKEN_INVALID', async () => {
			const unknownToken = `pjs_${'A'.repeat(43)}`;
			for (const authorization of [
				undefined,
				'Basic dXNlcjpwYXNz',
				'Bearer pjs_short',
				`Bearer ${unknownToken}`,
			]) {
				expect(await errorOf(await callMe({ authorization })), authorization).toMatchObject(
					{
						status: 401,
						code: SERVER_ERROR.AGENT_TOKEN_INVALID,
						message: expect.any(String),
					},
				);
			}
		});

		it('fails an expired token with 401 AGENT_TOKEN_EXPIRED', async () => {
			const longAgo = new Date(Date.now() - 100 * DAY_MS);
			const { authorization } = await tokenFor(
				MANAGER_ID,
				{ expiry: { kind: 'preset', days: 30 } },
				longAgo,
			);

			expect(await errorOf(await callMe({ authorization }))).toMatchObject({
				status: 401,
				code: SERVER_ERROR.AGENT_TOKEN_EXPIRED,
			});
		});

		it('fails a revoked token with 401 AGENT_TOKEN_REVOKED', async () => {
			const { tokenId, authorization } = await tokenFor(MANAGER_ID);
			await revokeAccessToken(MANAGER_ID, tokenId);

			expect(await errorOf(await callMe({ authorization }))).toMatchObject({
				status: 401,
				code: SERVER_ERROR.AGENT_TOKEN_REVOKED,
			});
		});

		it('fails every token once its account is deleted', async () => {
			const deletedUserId = fixtureId('deleted-user');
			await getDb()
				.insert(user)
				.values({
					id: deletedUserId,
					name: 'Leaving',
					email: `${deletedUserId}@example.com`,
				});
			const { authorization } = await tokenFor(deletedUserId);
			expect((await callMe({ authorization })).status).toBe(200);

			await getDb().delete(user).where(eq(user.id, deletedUserId));

			expect(await errorOf(await callMe({ authorization }))).toMatchObject({
				status: 401,
				code: SERVER_ERROR.AGENT_TOKEN_INVALID,
			});
		});
	});

	describe('demo', () => {
		it('rejects a request carrying a live demo cookie with 403 AGENT_DEMO_NOT_ALLOWED', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);

			expect(
				await errorOf(await callMe({ authorization, demoCookie: liveDemoCookie })),
			).toMatchObject({ status: 403, code: SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED });
			expect(
				(await callMe({ authorization, demoCookie: 'e'.repeat(64) })).status,
				'an expired or unknown demo',
			).toBe(200);
		});

		it('rejects a token of a demo identity', async () => {
			const { authorization } = await tokenFor(demoUserId);

			expect(await errorOf(await callMe({ authorization }))).toMatchObject({
				status: 403,
				code: SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED,
			});
		});
	});

	describe('request limits', () => {
		it('answers 429 with Retry-After and retryAfterSeconds over the per-token limit', async () => {
			const { tokenId, authorization } = await tokenFor(MANAGER_ID);
			const limitedKeys: string[] = [];
			const exhausted: AgentApiRateLimit = {
				limit: async ({ key }) => {
					limitedKeys.push(key);
					return { success: false };
				},
			};

			const response = await callMe({ authorization, rateLimit: exhausted });

			expect(response.status).toBe(429);
			expect(response.headers.get('retry-after')).toBe(
				String(AGENT_API_RATE_LIMIT.periodSeconds),
			);
			expect(await errorOf(response)).toMatchObject({
				code: SERVER_ERROR.AGENT_RATE_LIMITED,
				retryAfterSeconds: AGENT_API_RATE_LIMIT.periodSeconds,
			});
			expect(limitedKeys).toEqual([tokenId]);
		});

		it('fails closed without the rate-limit binding, except in development', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);
			const failing: AgentApiRateLimit = {
				limit: async () => {
					throw new Error('binding unavailable');
				},
			};

			expect(await errorOf(await callMe({ authorization, rateLimit: null }))).toMatchObject({
				status: 503,
				code: SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE,
			});
			expect(
				await errorOf(await callMe({ authorization, rateLimit: failing })),
			).toMatchObject({ status: 503, code: SERVER_ERROR.AGENT_RATE_LIMIT_UNAVAILABLE });
			applicationEnvironment.dev = true;
			expect((await callMe({ authorization, rateLimit: null })).status).toBe(200);
		});

		it('answers a batch over 200 items with 400 and the cap', async () => {
			const fixture = await createWishlistFixture();
			const { authorization } = await tokenFor(MANAGER_ID, { scopes: ['gifts:write'] });
			const batchEndpoint = agentApiEndpoint(async ({ token }) => ({
				body: await authorizeAgentOperations(
					token.grant,
					Array.from({ length: 201 }, () => ({
						operationName: 'createGift',
						input: { wishlistId: fixture.id, name: 'Kolo' },
					})),
				),
			}));

			const response = await batchEndpoint(
				apiEvent('/api/v1/batch', 'POST', { authorization }),
			);

			expect(await errorOf(response)).toMatchObject({
				status: 400,
				code: SERVER_ERROR.AGENT_BATCH_TOO_LARGE,
				maxItems: 200,
			});
		});

		it('answers unexpected failures with 500 and no internals', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			try {
				const failingEndpoint = agentApiEndpoint(async () => {
					throw new Error('connection string postgres://secret');
				});

				const response = await failingEndpoint(
					apiEvent('/api/v1/me', 'GET', { authorization }),
				);

				expect(response.status).toBe(500);
				const text = await response.text();
				expect(JSON.parse(text)).toMatchObject({
					error: { code: SERVER_ERROR.AGENT_INTERNAL_ERROR },
				});
				expect(text).not.toContain('secret');
			} finally {
				consoleSpy.mockRestore();
			}
		});

		it('echoes client error messages but hides server error messages', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			try {
				const failingWith = (status: number, message: string) =>
					agentApiEndpoint(async () => error(status, message))(
						apiEvent('/api/v1/me', 'GET', { authorization }),
					);

				expect(await errorOf(await failingWith(409, 'Gift changed meanwhile'))).toEqual({
					status: 409,
					code: SERVER_ERROR.CONFLICT,
					message: 'Gift changed meanwhile',
				});
				const serverFailure = await failingWith(503, 'database host db.internal is down');
				expect(serverFailure.status).toBe(503);
				const text = await serverFailure.text();
				expect(JSON.parse(text)).toMatchObject({
					error: { code: SERVER_ERROR.AGENT_INTERNAL_ERROR },
				});
				expect(text).not.toContain('db.internal');
			} finally {
				consoleSpy.mockRestore();
			}
		});

		it('answers an endpoint’s own status, headers and failures', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);
			const event = () => apiEvent('/api/v1/me', 'GET', { authorization });
			const created: AgentApiResponse = {
				body: { proposalId: 'proposal-1' },
				status: 201,
				headers: { location: '/api/v1/proposals/proposal-1' },
			};

			const success = await agentApiEndpoint(async () => created)(event());
			expect(success.status).toBe(201);
			expect(success.headers.get('location')).toBe('/api/v1/proposals/proposal-1');
			expect(await success.json()).toEqual({ proposalId: 'proposal-1' });

			const failure = await agentApiEndpoint(async () => {
				throw new AgentApiFailure(
					409,
					SERVER_ERROR.CONFLICT,
					{ proposalId: 'proposal-1' },
					{ 'retry-after': '5' },
				);
			})(event());
			expect(failure.headers.get('retry-after')).toBe('5');
			expect(await errorOf(failure)).toMatchObject({
				status: 409,
				code: SERVER_ERROR.CONFLICT,
				proposalId: 'proposal-1',
			});
		});
	});

	describe('operations', () => {
		async function sharedWishlistWithReservedLikedGift() {
			const fixture = await createWishlistFixture({
				sharedAt: new Date(Date.now() - 60 * 60 * 1000),
			});
			const giftId = await createGiftFixture(fixture.id, { quantity: 3 });
			await reserveGift(giftId, RESERVER_ID);
			await getDb().insert(reservation).values({
				giftId,
				anonymousName: ANONYMOUS_GIFTER_NAME,
				anonymousEmail: ANONYMOUS_GIFTER_EMAIL,
			});
			await getDb().insert(giftLike).values({ giftId, userId: RESERVER_ID });
			return fixture;
		}

		it('gives the recipient no reservation or like data, even with every scope', async () => {
			const fixture = await sharedWishlistWithReservedLikedGift();
			const { authorization } = await tokenFor(RECIPIENT_ID, { scopes: everyScope });

			const response = await callOperation(
				'readWishlistGifts',
				{ wishlistShortId: fixture.shortId },
				{ authorization },
			);

			expect(response.status).toBe(200);
			const text = await response.text();
			const [recipientGift] = JSON.parse(text).result.gifts;
			for (const field of RESERVATION_AND_LIKE_FIELDS) {
				expect(recipientGift).not.toHaveProperty(field);
			}
			for (const identity of [
				RESERVER_NAME,
				RESERVER_EMAIL,
				ANONYMOUS_GIFTER_NAME,
				ANONYMOUS_GIFTER_EMAIL,
			]) {
				expect(text).not.toContain(identity);
			}
		});

		it('names reservers only with reservations:identities, and never an anonymous email', async () => {
			const fixture = await sharedWishlistWithReservedLikedGift();
			const readOnly = await tokenFor(MANAGER_ID);
			const withIdentities = await tokenFor(MANAGER_ID, {
				scopes: ['reservations:identities'],
			});
			const input = { wishlistShortId: fixture.shortId };

			const countsOnly = await (
				await callOperation('readWishlistGifts', input, readOnly)
			).text();
			const named = await (
				await callOperation('readWishlistGifts', input, withIdentities)
			).text();

			expect(JSON.parse(countsOnly).result.gifts[0]).toMatchObject({ reservedCount: 2 });
			expect(JSON.parse(countsOnly).result.gifts[0]).not.toHaveProperty('reserverNames');
			expect(countsOnly).not.toContain(RESERVER_NAME);
			expect(JSON.parse(named).result.gifts[0].reserverNames).toEqual(
				expect.arrayContaining([RESERVER_NAME, ANONYMOUS_GIFTER_NAME]),
			);
			expect(named).not.toContain(ANONYMOUS_GIFTER_EMAIL);
			expect(named).not.toContain(RESERVER_EMAIL);
		});

		it('loses správce rights on the next call as soon as the user loses the role', async () => {
			const fixture = await sharedWishlistWithReservedLikedGift();
			const { authorization } = await tokenFor(MANAGER_ID, { scopes: everyScope });
			const categoryInput = { wishlistId: fixture.id };
			const giftsInput = { wishlistShortId: fixture.shortId };
			expect(
				(
					await callOperation('readGiftCategorySettingsRows', categoryInput, {
						authorization,
					})
				).status,
			).toBe(200);

			await getDb()
				.update(moderatorAssignment)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(moderatorAssignment.wishlistId, fixture.id),
						eq(moderatorAssignment.userId, MANAGER_ID),
					),
				);

			const settingsResponse = await callOperation(
				'readGiftCategorySettingsRows',
				categoryInput,
				{
					authorization,
				},
			);
			expect(settingsResponse.status).toBe(403);
			const giftsText = await (
				await callOperation('readWishlistGifts', giftsInput, { authorization })
			).text();
			expect(JSON.parse(giftsText).result.role).toBe('visitor');
			expect(giftsText).not.toContain(RESERVER_NAME);
		});

		it('rejects a wishlist outside the token restriction with 403 AGENT_WISHLIST_NOT_ALLOWED', async () => {
			const allowed = await createWishlistFixture();
			const other = await createWishlistFixture();
			const { authorization } = await tokenFor(MANAGER_ID, { wishlistIds: [allowed.id] });

			expect(
				await errorOf(
					await callOperation(
						'readWishlistGifts',
						{ wishlistShortId: other.shortId },
						{ authorization },
					),
				),
			).toMatchObject({ status: 403, code: SERVER_ERROR.AGENT_WISHLIST_NOT_ALLOWED });
		});

		it('answers a change without its scope with 403 AGENT_SCOPE_MISSING and with it 409, since changes need a proposal', async () => {
			const fixture = await createWishlistFixture();
			const readOnly = await tokenFor(MANAGER_ID);
			const writer = await tokenFor(MANAGER_ID, { scopes: ['gifts:write'] });
			const input = { wishlistId: fixture.id, name: 'Kolo' };

			expect(await errorOf(await callOperation('createGift', input, readOnly))).toMatchObject(
				{
					status: 403,
					code: SERVER_ERROR.AGENT_SCOPE_MISSING,
				},
			);
			expect(await errorOf(await callOperation('createGift', input, writer))).toMatchObject({
				status: 409,
				code: SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL,
			});
		});

		it('reports human-only and unknown operations alike as not found', async () => {
			const fixture = await createWishlistFixture();
			const { authorization } = await tokenFor(MANAGER_ID, { scopes: everyScope });

			for (const operationName of ['shareWishlist', 'noSuchOperation']) {
				expect(
					await errorOf(
						await callOperation(
							operationName,
							{ wishlistId: fixture.id },
							{ authorization },
						),
					),
					operationName,
				).toMatchObject({ status: 404, code: SERVER_ERROR.AGENT_OPERATION_NOT_FOUND });
			}
		});

		it('requires a JSON body within the size limit', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);

			expect(
				await errorOf(
					await callOperation(
						'readAccessibleWishlists',
						{},
						{
							authorization,
							contentType: 'text/plain',
						},
					),
				),
			).toMatchObject({ status: 415, code: SERVER_ERROR.AGENT_UNSUPPORTED_MEDIA_TYPE });
			expect(
				await errorOf(
					await callOperation(
						'readAccessibleWishlists',
						{},
						{ authorization, body: '{' },
					),
				),
			).toMatchObject({ status: 400, code: SERVER_ERROR.AGENT_REQUEST_INVALID });
			expect(
				await errorOf(
					await callOperation(
						'readAccessibleWishlists',
						{},
						{
							authorization,
							body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
						},
					),
				),
			).toMatchObject({ status: 413, code: SERVER_ERROR.AGENT_REQUEST_TOO_LARGE });
		});

		it('stops reading a chunked body at the size limit, whatever its Content-Length says', async () => {
			const { authorization } = await tokenFor(MANAGER_ID);
			const chunk = new TextEncoder().encode(' '.repeat(64 * 1024));
			let streamedBytes = 0;
			const endlessBody = new ReadableStream<Uint8Array>({
				pull(controller) {
					streamedBytes += chunk.byteLength;
					controller.enqueue(chunk);
				},
			});
			const operationName = 'readAccessibleWishlists';
			const path = `/api/v1/operations/${operationName}`;
			const requestInit: RequestInit & { duplex: 'half' } = {
				method: 'POST',
				headers: {
					authorization,
					'content-type': 'application/json',
					'content-length': 'not-a-number',
				},
				body: endlessBody,
				duplex: 'half',
			};
			const event = {
				...apiEvent(path, 'POST', { authorization, operationName }),
				request: new Request(`https://prejemesi.cz${path}`, requestInit),
			};

			expect(await errorOf(await route(postOperation)(event))).toMatchObject({
				status: 413,
				code: SERVER_ERROR.AGENT_REQUEST_TOO_LARGE,
				maxBytes: AGENT_API_MAX_BODY_BYTES,
			});
			expect(streamedBytes).toBeLessThan(AGENT_API_MAX_BODY_BYTES + 4 * chunk.byteLength);
		});
	});

	describe('wishlists', () => {
		async function listWishlists(authorization: string) {
			const response = await route(getWishlists)(
				apiEvent('/api/v1/wishlists', 'GET', { authorization }),
			);
			expect(response.status).toBe(200);
			return ((await response.json()) as { wishlists: { id: string }[] }).wishlists;
		}

		it('lists the wishlists the user receives or manages, with role and kind', async () => {
			const fixture = await createWishlistFixture({ kind: 'permanent' });
			const recipient = await tokenFor(RECIPIENT_ID);
			const manager = await tokenFor(MANAGER_ID);

			expect(await listWishlists(recipient.authorization)).toContainEqual(
				expect.objectContaining({ id: fixture.id, role: 'recipient', kind: 'permanent' }),
			);
			expect(await listWishlists(manager.authorization)).toContainEqual(
				expect.objectContaining({ id: fixture.id, role: 'moderator', kind: 'permanent' }),
			);
		});

		it('lists only the restricted wishlists for a restricted token', async () => {
			const allowed = await createWishlistFixture();
			await createWishlistFixture();
			const { authorization } = await tokenFor(MANAGER_ID, { wishlistIds: [allowed.id] });

			expect((await listWishlists(authorization)).map((listed) => listed.id)).toEqual([
				allowed.id,
			]);
		});
	});
});
