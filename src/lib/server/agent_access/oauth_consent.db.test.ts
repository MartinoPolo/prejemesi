import {
	DB_READY,
	MANAGER_ID,
	createWishlistFixture,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeSignature } from 'better-auth/crypto';
import {
	acceptOauthConsent,
	acceptedScopes,
	loadOauthConsent,
	readOauthConsentRequest,
	redirectSourceOf,
	type OauthConsentRequest,
} from './oauth_consent.js';
import { findActiveOauthGrant, saveOauthGrant } from './oauth_grants.js';
import {
	createOauthClientFixture,
	epochSeconds,
	removeOauthClientFixtures,
} from './oauth.db.test-setup.js';

const AUTH_SECRET = 'test-oauth-consent-secret-with-enough-entropy';
const REDIRECT_URI = 'https://ai-app.example/oauth/callback';
const CONSENT_REDIRECT = 'https://ai-app.example/oauth/callback?code=abc&state=xyz';

/** The authorization request as the provider signs it into the consent page's query. */
async function signedQuery(
	parameters: Record<string, string>,
	options: { secret?: string; expiresInSeconds?: number } = {},
): Promise<URLSearchParams> {
	const query = new URLSearchParams({
		...parameters,
		exp: String(epochSeconds() + (options.expiresInSeconds ?? 600)),
	});
	const canonical = new URLSearchParams(
		[...query.entries()].sort(([first], [second]) =>
			first < second ? -1 : first > second ? 1 : 0,
		),
	);
	query.append('sig', await makeSignature(canonical.toString(), options.secret ?? AUTH_SECRET));
	return query;
}

function consentRequest(overrides: Partial<OauthConsentRequest> = {}): OauthConsentRequest {
	return {
		clientId: 'unknown-client',
		redirectUri: REDIRECT_URI,
		requestedScopes: ['read'],
		offlineAccess: false,
		oauthQuery: 'sig=signed',
		...overrides,
	};
}

describe('OAuth consent request', () => {
	const authorization = {
		client_id: 'client-1',
		redirect_uri: REDIRECT_URI,
		response_type: 'code',
		scope: 'offline_access reservations:write openid read gifts:write',
	};

	it('reads a signed request with the agent scopes in canonical order', async () => {
		const query = await signedQuery(authorization);

		expect(await readOauthConsentRequest(query, AUTH_SECRET)).toEqual({
			clientId: 'client-1',
			redirectUri: REDIRECT_URI,
			requestedScopes: ['read', 'gifts:write', 'reservations:write'],
			offlineAccess: true,
			oauthQuery: query.toString(),
		});
	});

	it('reads nothing from a request without a client or redirect, or that is not the provider’s', async () => {
		const without = (omitted: string) =>
			Object.fromEntries(Object.entries(authorization).filter(([name]) => name !== omitted));
		const tampered = await signedQuery(authorization);
		tampered.set('scope', `${authorization.scope} managers:invite`);

		const unreadable = {
			'no client': await signedQuery(without('client_id')),
			'no redirect': await signedQuery(without('redirect_uri')),
			tampered,
			'another secret': await signedQuery(authorization, { secret: 'another-secret' }),
			expired: await signedQuery(authorization, { expiresInSeconds: -60 }),
			unsigned: new URLSearchParams(authorization),
		};

		for (const [label, query] of Object.entries(unreadable)) {
			expect(await readOauthConsentRequest(query, AUTH_SECRET), label).toBeNull();
		}
	});

	it('accepts only requested scopes the user ticked, and read whenever the app asks for it', () => {
		const request = consentRequest({
			requestedScopes: ['read', 'gifts:write', 'reservations:write'],
		});

		expect(acceptedScopes(request, [])).toEqual(['read']);
		expect(
			acceptedScopes(request, ['reservations:write', 'managers:invite', 'offline_access']),
		).toEqual(['read', 'reservations:write']);
		expect(acceptedScopes({ requestedScopes: ['gifts:write'] }, ['read'])).toEqual([]);
	});

	it('names the redirect origin, or the scheme of a native app’s private-use redirect', () => {
		expect(redirectSourceOf(consentRequest({ redirectUri: `${REDIRECT_URI}?a=1#b` }))).toBe(
			'https://ai-app.example',
		);
		expect(
			redirectSourceOf(consentRequest({ redirectUri: 'http://127.0.0.1:33418/callback' })),
		).toBe('http://127.0.0.1:33418');
		expect(redirectSourceOf(consentRequest({ redirectUri: 'com.example.app:/callback' }))).toBe(
			'com.example.app:',
		);
		expect(redirectSourceOf(consentRequest({ redirectUri: 'not a url' }))).toBeNull();
	});
});

describe.skipIf(!DB_READY)('OAuth consent', () => {
	beforeAll(seedFixtureUsers);

	afterAll(async () => {
		if (DB_READY) {
			await removeOauthClientFixtures();
		}
		await removeFixtureRows();
	});

	it('shows the verified client host and redirect host, and pre-fills the existing restriction', async () => {
		const fixture = await createWishlistFixture();
		const clientId = await createOauthClientFixture({
			clientId: `https://ai-app.example/${randomUUID()}/client.json`,
			clientDiscoveryId: 'cimd',
			name: 'AI app',
		});
		await saveOauthGrant(MANAGER_ID, clientId, { scopes: [], wishlistIds: [fixture.id] });

		const view = await loadOauthConsent(
			MANAGER_ID,
			consentRequest({
				clientId,
				redirectUri: 'https://callback.ai-app.example/done',
				requestedScopes: ['read', 'gifts:write'],
			}),
		);

		expect(view).toMatchObject({
			client: { name: 'AI app', verifiedHost: 'ai-app.example' },
			redirectHost: 'callback.ai-app.example',
			requestedScopes: ['read', 'gifts:write'],
			wishlistIds: [fixture.id],
		});
	});

	it('shows no consent for an unknown or disabled client', async () => {
		const disabledClientId = await createOauthClientFixture({ disabled: true });

		expect(await loadOauthConsent(MANAGER_ID, consentRequest())).toBeNull();
		expect(
			await loadOauthConsent(MANAGER_ID, consentRequest({ clientId: disabledClientId })),
		).toBeNull();
	});

	it('records the grant and continues where the provider’s consent answers', async () => {
		const clientId = await createOauthClientFixture();
		const consent = vi.fn(async () => CONSENT_REDIRECT);

		const location = await acceptOauthConsent({
			userId: MANAGER_ID,
			request: consentRequest({
				clientId,
				requestedScopes: ['read', 'gifts:write'],
				offlineAccess: true,
			}),
			scopes: ['read', 'gifts:write'],
			wishlistIds: null,
			consent,
		});

		expect(location).toBe(CONSENT_REDIRECT);
		expect(consent).toHaveBeenCalledWith('read gifts:write offline_access');
		expect((await findActiveOauthGrant(MANAGER_ID, clientId))?.row.scopes).toEqual([
			'read',
			'gifts:write',
		]);
	});

	it('accepts what the app asked for when nothing is accepted', async () => {
		const clientId = await createOauthClientFixture();
		const consent = vi.fn(async () => CONSENT_REDIRECT);

		await acceptOauthConsent({
			userId: MANAGER_ID,
			request: consentRequest({ clientId, requestedScopes: [] }),
			scopes: [],
			wishlistIds: null,
			consent,
		});

		expect(consent).toHaveBeenCalledWith(undefined);
	});

	it('removes a grant it created when the provider’s consent fails', async () => {
		const clientId = await createOauthClientFixture();
		const failure = new Error('consent failed');

		await expect(
			acceptOauthConsent({
				userId: MANAGER_ID,
				request: consentRequest({ clientId }),
				scopes: ['read'],
				wishlistIds: null,
				consent: async () => {
					throw failure;
				},
			}),
		).rejects.toBe(failure);
		expect(await findActiveOauthGrant(MANAGER_ID, clientId)).toBeNull();
	});

	it('keeps a grant that existed before a failed consent', async () => {
		const clientId = await createOauthClientFixture();
		const { grantId } = await saveOauthGrant(MANAGER_ID, clientId, {
			scopes: [],
			wishlistIds: null,
		});

		await expect(
			acceptOauthConsent({
				userId: MANAGER_ID,
				request: consentRequest({ clientId }),
				scopes: ['read'],
				wishlistIds: null,
				consent: async () => {
					throw new Error('consent failed');
				},
			}),
		).rejects.toThrow('consent failed');
		expect((await findActiveOauthGrant(MANAGER_ID, clientId))?.row.id).toBe(grantId);
	});
});
