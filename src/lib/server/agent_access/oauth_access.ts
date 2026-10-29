import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyJwsAccessToken } from 'better-auth/oauth2';
import { getDb } from '$lib/server/db/index.js';
import { oauthClient, user } from '$lib/server/db/auth.schema.js';
import { agentAccessOauthGrant } from '$lib/server/db/access_token.schema.js';
import { isReservedDemoEmail } from '$lib/server/auth.js';
import { appChannel } from '$lib/server/operations/actor.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { AGENT_SCOPE, isAgentScope, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from './agent_caller.js';
import { grantedScopes } from './access_tokens.js';
import { OFFLINE_ACCESS_SCOPE, type OauthEndpoints } from './oauth_endpoints.js';
import {
	OAUTH_CLIENT_DISPLAY_COLUMNS,
	deleteClientAuthorization,
	oauthClientDisplay,
	oauthGrantWishlistIds,
	recordOauthGrantUse,
} from './oauth_grants.js';

/** A JSON Web Key Set as the jwt plugin serves it. */
export interface JsonWebKeySet {
	keys: Record<string, unknown>[];
}

/** Resolves an app's access token, as `/mcp` accepts it, to the user and grant it acts for. */
export interface OauthAccessVerifier {
	endpoints: OauthEndpoints;
	authenticate(accessToken: string, now?: Date): Promise<AgentCaller>;
}

/** Shared by every verifier in the isolate, so the key set is read at most every few minutes. */
const JWKS_CACHE_KEY = {};

const JOSE_EXPIRED_CODE = 'ERR_JWT_EXPIRED';

function isJoseError(thrown: unknown): thrown is Error & { code: string } {
	return (
		thrown instanceof Error &&
		'code' in thrown &&
		typeof thrown.code === 'string' &&
		thrown.code.startsWith('ERR_J')
	);
}

async function verifiedClaims(
	accessToken: string,
	endpoints: OauthEndpoints,
	jwks: () => Promise<JsonWebKeySet>,
) {
	try {
		return await verifyJwsAccessToken(accessToken, {
			jwksFetch: jwks,
			jwksCacheKey: JWKS_CACHE_KEY,
			verifyOptions: { issuer: endpoints.issuer, audience: endpoints.resource },
		});
	} catch (thrown) {
		if (isJoseError(thrown) && thrown.code === JOSE_EXPIRED_CODE) {
			error(401, SERVER_ERROR.AGENT_TOKEN_EXPIRED);
		}
		// Not a JWT at all, a bad signature, or another issuer's or audience's token.
		if (isJoseError(thrown) || thrown instanceof TypeError) {
			error(401, SERVER_ERROR.AGENT_TOKEN_INVALID);
		}
		throw thrown;
	}
}

/**
 * The token's scopes within what the user granted the app, so neither can widen the other.
 * `read` is never implied: a token issued without it reads nothing until the app asks.
 */
function effectiveScopes(tokenScope: unknown, grantScopes: readonly AgentScope[]): AgentScope[] {
	const tokenScopes = new Set(
		typeof tokenScope === 'string' ? tokenScope.split(' ').filter(isAgentScope) : [],
	);
	return grantScopes.filter((scope) => tokenScopes.has(scope));
}

/**
 * Verifies an access token issued for `/mcp` and maps it to its grant: signature, issuer, MCP
 * audience and expiry by the token; the user, client and revocation by the grant row, read on
 * every call. A token without a live grant also clears the client's authorization, so its next
 * sign-in asks for consent again instead of minting tokens no grant backs.
 */
export function createOauthAccessVerifier(
	endpoints: OauthEndpoints,
	jwks: () => Promise<JsonWebKeySet>,
): OauthAccessVerifier {
	return {
		endpoints,
		async authenticate(accessToken, now = new Date()) {
			const claims = await verifiedClaims(accessToken, endpoints, jwks);
			const userId = claims.sub;
			const clientId = claims.client_id;
			// A sender-constrained (DPoP) token is not usable as a bearer token.
			if (typeof userId !== 'string' || typeof clientId !== 'string' || 'cnf' in claims) {
				error(401, SERVER_ERROR.AGENT_TOKEN_INVALID);
			}
			const [found] = await getDb()
				.select({
					grant: agentAccessOauthGrant,
					userName: user.name,
					userEmail: user.email,
					userDemoSessionId: user.demoSessionId,
					client: OAUTH_CLIENT_DISPLAY_COLUMNS,
					clientDisabled: oauthClient.disabled,
				})
				.from(agentAccessOauthGrant)
				.innerJoin(user, eq(user.id, agentAccessOauthGrant.userId))
				.innerJoin(oauthClient, eq(oauthClient.clientId, agentAccessOauthGrant.clientId))
				.where(
					and(
						eq(agentAccessOauthGrant.userId, userId),
						eq(agentAccessOauthGrant.clientId, clientId),
						isNull(agentAccessOauthGrant.revokedAt),
					),
				)
				.limit(1);
			if (found === undefined) {
				await deleteClientAuthorization(getDb(), userId, clientId);
				error(401, SERVER_ERROR.AGENT_TOKEN_REVOKED);
			}
			// A token from before a revoke and a new consent is still revoked; `iat` is in seconds.
			const issuedBeforeGrant =
				typeof claims.iat !== 'number' ||
				claims.iat < Math.floor(found.grant.createdAt.getTime() / 1000);
			if (issuedBeforeGrant || found.clientDisabled === true) {
				error(401, SERVER_ERROR.AGENT_TOKEN_REVOKED);
			}
			if (found.userDemoSessionId !== null || isReservedDemoEmail(found.userEmail)) {
				error(403, SERVER_ERROR.AGENT_DEMO_NOT_ALLOWED);
			}
			const wishlistIds = await oauthGrantWishlistIds(found.grant);
			const { name } = oauthClientDisplay(found.client);
			recordOauthGrantUse(found.grant, now);
			return {
				credential: { kind: AGENT_CREDENTIAL_KIND.oauthGrant, id: found.grant.id },
				fastForward: false,
				grant: {
					userId,
					userName: found.userName,
					tokenName: name,
					channel: appChannel(name),
					scopes: effectiveScopes(claims.scope, found.grant.scopes),
					wishlistIds,
				},
			};
		},
	};
}

const CHALLENGE_SCHEME = 'Bearer';

function challengeHeader(parameters: Record<string, string>): string {
	const rendered = Object.entries(parameters).map(
		([name, value]) => `${name}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`,
	);
	return `${CHALLENGE_SCHEME} ${rendered.join(', ')}`;
}

/**
 * The scopes a challenge asks for. Clients request exactly these, and the provider issues a
 * refresh token only for `offline_access`, so without it an app would sign in again whenever its
 * short-lived access token expires.
 */
function challengedScopes(agentScopes: readonly AgentScope[]): string {
	return [...grantedScopes(agentScopes), OFFLINE_ACCESS_SCOPE].join(' ');
}

/**
 * The 401 challenge every `/mcp` authentication failure answers with (RFC 9728): where to
 * discover the authorization server, and the scope to start with.
 */
export function unauthorizedChallenge(endpoints: OauthEndpoints, tokenPresented: boolean): string {
	return challengeHeader({
		...(tokenPresented ? { error: 'invalid_token' } : {}),
		resource_metadata: endpoints.resourceMetadataUrl,
		scope: challengedScopes([AGENT_SCOPE.read]),
	});
}

/**
 * The 403 step-up challenge (RFC 6750): the scopes the app already has plus the one the call
 * needs, so authorizing again keeps the others.
 */
export function insufficientScopeChallenge(
	endpoints: OauthEndpoints,
	currentScopes: readonly AgentScope[],
	neededScope: AgentScope,
): string {
	return challengeHeader({
		error: 'insufficient_scope',
		scope: challengedScopes([...currentScopes, neededScope]),
		resource_metadata: endpoints.resourceMetadataUrl,
		error_description: `This call needs the ${neededScope} scope.`,
	});
}
