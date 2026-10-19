import { generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto';
import { like } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { oauthClient } from '$lib/server/db/auth.schema.js';
import { createOauthAccessVerifier, type JsonWebKeySet } from './oauth_access.js';
import { oauthEndpoints } from './oauth_endpoints.js';

/** The origin every OAuth test token is issued for, as `/mcp` on production resolves it. */
export const OAUTH_TEST_ORIGIN = 'https://prejemesi.cz';
export const OAUTH_TEST_ENDPOINTS = oauthEndpoints(OAUTH_TEST_ORIGIN);

/** Unique per test file so parallel files never touch each other's clients. */
const CLIENT_ID_PREFIX = `test-oauth-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`;
const KEY_ID = `test-oauth-key-${randomUUID()}`;
const SIGNING_ALGORITHM = 'EdDSA';
const ACCESS_TOKEN_LIFETIME_SECONDS = 600;

const signingKeys = generateKeyPairSync('ed25519');
const TEST_JWKS: JsonWebKeySet = {
	keys: [
		{
			...signingKeys.publicKey.export({ format: 'jwk' }),
			kid: KEY_ID,
			alg: SIGNING_ALGORITHM,
			use: 'sig',
		},
	],
};

/** A key the provider never published, for tokens whose signature must not verify. */
export function foreignSigningKey(): KeyObject {
	return generateKeyPairSync('ed25519').privateKey;
}

function base64UrlJson(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function epochSeconds(date = new Date()): number {
	return Math.floor(date.getTime() / 1000);
}

/**
 * An access token as the provider issues it for `/mcp`: signed by the published key, with the
 * issuer and audience of {@link OAUTH_TEST_ENDPOINTS}. `claims` override or add claims; an
 * undefined claim is left out.
 */
export function mintOauthAccessToken(
	claims: Record<string, unknown>,
	signingKey: KeyObject = signingKeys.privateKey,
): string {
	const issuedAt = epochSeconds();
	const payload = Object.fromEntries(
		Object.entries({
			iss: OAUTH_TEST_ENDPOINTS.issuer,
			aud: OAUTH_TEST_ENDPOINTS.resource,
			iat: issuedAt,
			exp: issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS,
			...claims,
		}).filter(([, value]) => value !== undefined),
	);
	const signingInput = `${base64UrlJson({ alg: SIGNING_ALGORITHM, kid: KEY_ID, typ: 'at+jwt' })}.${base64UrlJson(payload)}`;
	const signature = sign(null, Buffer.from(signingInput), signingKey).toString('base64url');
	return `${signingInput}.${signature}`;
}

/** The verifier `/mcp` uses, reading the test key set instead of BetterAuth's. */
export function createTestOauthVerifier() {
	return createOauthAccessVerifier(OAUTH_TEST_ENDPOINTS, async () => TEST_JWKS);
}

let clientCounter = 0;

/** A registered OAuth client, removed again by {@link removeOauthClientFixtures}. */
export async function createOauthClientFixture(
	values: Partial<typeof oauthClient.$inferInsert> = {},
): Promise<string> {
	clientCounter += 1;
	const clientId = values.clientId ?? `${CLIENT_ID_PREFIX}${clientCounter}`;
	await getDb()
		.insert(oauthClient)
		.values({
			id: `${CLIENT_ID_PREFIX}row-${clientCounter}`,
			name: 'Test AI app',
			redirectUris: ['https://ai-app.example/oauth/callback'],
			...values,
			clientId,
		});
	return clientId;
}

/** Deletes this file's clients, and with them their grants; call before closing the database. */
export async function removeOauthClientFixtures(): Promise<void> {
	await getDb()
		.delete(oauthClient)
		.where(like(oauthClient.id, `${CLIENT_ID_PREFIX}%`));
}
