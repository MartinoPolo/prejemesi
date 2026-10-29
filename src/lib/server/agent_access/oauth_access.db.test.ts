import {
	DB_READY,
	MANAGER_ID,
	createWishlistFixture,
	expectRejection,
	fixtureId,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { user } from '$lib/server/db/auth.schema.js';
import { demoEmailAddress } from '$lib/server/demo/constants.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { appChannel } from '$lib/server/operations/actor.js';
import { AGENT_CREDENTIAL_KIND } from './agent_caller.js';
import { insufficientScopeChallenge, unauthorizedChallenge } from './oauth_access.js';
import { revokeOauthGrant, saveOauthGrant } from './oauth_grants.js';
import {
	OAUTH_TEST_ENDPOINTS,
	OAUTH_TEST_ORIGIN,
	createOauthClientFixture,
	createTestOauthVerifier,
	epochSeconds,
	foreignSigningKey,
	mintOauthAccessToken,
	removeOauthClientFixtures,
} from './oauth.db.test-setup.js';

const RESOURCE_METADATA_URL = `${OAUTH_TEST_ORIGIN}/.well-known/oauth-protected-resource/mcp`;

describe('OAuth challenges', () => {
	it('names the resource metadata and the starting scope, with invalid_token only for a presented token', () => {
		expect(unauthorizedChallenge(OAUTH_TEST_ENDPOINTS, false)).toBe(
			`Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="read offline_access"`,
		);
		expect(unauthorizedChallenge(OAUTH_TEST_ENDPOINTS, true)).toBe(
			`Bearer error="invalid_token", resource_metadata="${RESOURCE_METADATA_URL}", scope="read offline_access"`,
		);
	});

	it('steps up to the current scopes plus the needed one in canonical order, with offline_access', () => {
		const challenge = insufficientScopeChallenge(
			OAUTH_TEST_ENDPOINTS,
			['read', 'reservations:identities', 'reservations:write'],
			'gifts:write',
		);

		expect(challenge).toMatch(/^Bearer error="insufficient_scope", /);
		expect(challenge).toContain(
			'scope="read gifts:write reservations:write reservations:identities offline_access"',
		);
		expect(challenge).toContain(`resource_metadata="${RESOURCE_METADATA_URL}"`);
	});
});

describe.skipIf(!DB_READY)('OAuth access token verification', () => {
	const verifier = createTestOauthVerifier();
	const demoUserId = fixtureId('oauth-demo-user');

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

	async function connectedApp(
		input: {
			scopes?: Parameters<typeof saveOauthGrant>[2]['scopes'];
			wishlistIds?: string[];
		} = {},
		userId = MANAGER_ID,
	) {
		const clientId = await createOauthClientFixture({ name: 'Claude' });
		const { grantId } = await saveOauthGrant(userId, clientId, {
			scopes: input.scopes ?? [],
			wishlistIds: input.wishlistIds ?? null,
		});
		return { clientId, grantId };
	}

	it('acts for the grant’s user as the app, without fast-forward', async () => {
		const fixture = await createWishlistFixture();
		const { clientId, grantId } = await connectedApp({
			scopes: ['gifts:write'],
			wishlistIds: [fixture.id],
		});

		const caller = await verifier.authenticate(
			mintOauthAccessToken({
				sub: MANAGER_ID,
				client_id: clientId,
				scope: 'read gifts:write offline_access',
			}),
		);

		expect(caller).toEqual({
			credential: { kind: AGENT_CREDENTIAL_KIND.oauthGrant, id: grantId },
			fastForward: false,
			grant: {
				userId: MANAGER_ID,
				userName: 'Manager',
				tokenName: 'Claude',
				channel: appChannel('Claude'),
				scopes: ['read', 'gifts:write'],
				wishlistIds: [fixture.id],
			},
		});
	});

	it('limits the scopes to those both the token and the grant carry', async () => {
		const { clientId } = await connectedApp({ scopes: ['reservations:write'] });

		const widerToken = await verifier.authenticate(
			mintOauthAccessToken({
				sub: MANAGER_ID,
				client_id: clientId,
				scope: 'read gifts:write reservations:write managers:invite offline_access',
			}),
		);
		const narrowerToken = await verifier.authenticate(
			mintOauthAccessToken({ sub: MANAGER_ID, client_id: clientId, scope: 'gifts:write' }),
		);

		expect(widerToken.grant.scopes).toEqual(['read', 'reservations:write']);
		expect(narrowerToken.grant.scopes).toEqual([]);
		expect(widerToken.grant.wishlistIds).toBeNull();
	});

	it('refuses a token that is not the provider’s access token for /mcp', async () => {
		const { clientId } = await connectedApp();
		const claims = { sub: MANAGER_ID, client_id: clientId, scope: 'read' };
		const refused = {
			'another audience': mintOauthAccessToken({
				...claims,
				aud: `${OAUTH_TEST_ORIGIN}/api/v1`,
			}),
			'another issuer': mintOauthAccessToken({ ...claims, iss: 'https://evil.example' }),
			'a foreign signature': mintOauthAccessToken(claims, foreignSigningKey()),
			'no client': mintOauthAccessToken({ ...claims, client_id: undefined }),
			'no subject': mintOauthAccessToken({ ...claims, sub: undefined }),
			'a sender-constrained token': mintOauthAccessToken({
				...claims,
				cnf: { jkt: 'thumbprint' },
			}),
			'not a JWT': 'not-a-jwt',
		};

		for (const [label, accessToken] of Object.entries(refused)) {
			await expect(verifier.authenticate(accessToken), label).rejects.toMatchObject({
				status: 401,
				body: { message: SERVER_ERROR.AGENT_TOKEN_INVALID },
			});
		}
	});

	it('refuses an expired token', async () => {
		const { clientId } = await connectedApp();
		const hourAgo = epochSeconds() - 3600;

		await expectRejection(
			verifier.authenticate(
				mintOauthAccessToken({
					sub: MANAGER_ID,
					client_id: clientId,
					scope: 'read',
					iat: hourAgo,
					exp: hourAgo + 600,
				}),
			),
			401,
			SERVER_ERROR.AGENT_TOKEN_EXPIRED,
		);
	});

	it('stops a still-valid token on the next call once its grant is revoked', async () => {
		const { clientId, grantId } = await connectedApp();
		const accessToken = mintOauthAccessToken({
			sub: MANAGER_ID,
			client_id: clientId,
			scope: 'read',
		});
		await verifier.authenticate(accessToken);

		await revokeOauthGrant(MANAGER_ID, grantId);

		await expectRejection(
			verifier.authenticate(accessToken),
			401,
			SERVER_ERROR.AGENT_TOKEN_REVOKED,
		);
	});

	it('keeps a token issued before a revoke and a new consent revoked, by its issue second', async () => {
		const { clientId, grantId } = await connectedApp();
		await revokeOauthGrant(MANAGER_ID, grantId);
		const consentedAgain = new Date();
		await saveOauthGrant(
			MANAGER_ID,
			clientId,
			{ scopes: [], wishlistIds: null },
			consentedAgain,
		);
		const claims = { sub: MANAGER_ID, client_id: clientId, scope: 'read' };

		await expectRejection(
			verifier.authenticate(
				mintOauthAccessToken({ ...claims, iat: epochSeconds(consentedAgain) - 1 }),
			),
			401,
			SERVER_ERROR.AGENT_TOKEN_REVOKED,
		);
		const issuedInConsentSecond = await verifier.authenticate(
			mintOauthAccessToken({ ...claims, iat: epochSeconds(consentedAgain) }),
		);
		expect(issuedInConsentSecond.grant.userId).toBe(MANAGER_ID);
	});

	it('never authenticates a demo identity', async () => {
		const { clientId } = await connectedApp({}, demoUserId);

		await expectRejection(
			verifier.authenticate(
				mintOauthAccessToken({ sub: demoUserId, client_id: clientId, scope: 'read' }),
			),
			403,
			SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED,
		);
	});

	it('fails every token once its account is deleted', async () => {
		const leavingUserId = fixtureId('oauth-leaving-user');
		await getDb()
			.insert(user)
			.values({ id: leavingUserId, name: 'Leaving', email: `${leavingUserId}@example.com` });
		const { clientId } = await connectedApp({}, leavingUserId);
		const accessToken = mintOauthAccessToken({
			sub: leavingUserId,
			client_id: clientId,
			scope: 'read',
		});
		await verifier.authenticate(accessToken);

		await getDb().delete(user).where(eq(user.id, leavingUserId));

		await expect(verifier.authenticate(accessToken)).rejects.toMatchObject({ status: 401 });
	});
});
