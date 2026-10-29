import { eq } from 'drizzle-orm';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { getDb } from '$lib/server/db/index.js';
import { oauthClient } from '$lib/server/db/auth.schema.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import type { OauthConsentView } from '$lib/modules/access_tokens/types.js';
import {
	OAUTH_CLIENT_DISPLAY_COLUMNS,
	deleteOauthGrant,
	findActiveOauthGrant,
	oauthClientDisplay,
	saveOauthGrant,
} from './oauth_grants.js';
import { OFFLINE_ACCESS_SCOPE } from './oauth_endpoints.js';

/** An app's authorization request as the provider signed it into the consent page's URL. */
export interface OauthConsentRequest {
	clientId: string;
	redirectUri: string;
	/** The agent scopes the app asks for, in canonical order. */
	requestedScopes: AgentScope[];
	/** Whether the app asks to stay signed in with a refresh token. */
	offlineAccess: boolean;
	/** The signed query, passed back to the provider unchanged. */
	oauthQuery: string;
}

/**
 * Reads the authorization request from the consent page's query, or null when its signature does
 * not verify or it has expired, so nothing an attacker writes into the URL is shown or acted on.
 */
export async function readOauthConsentRequest(
	searchParams: URLSearchParams,
	secret: string,
): Promise<OauthConsentRequest | null> {
	const oauthQuery = searchParams.toString();
	const clientId = searchParams.get('client_id');
	const redirectUri = searchParams.get('redirect_uri');
	if (clientId === null || redirectUri === null) {
		return null;
	}
	if (!(await verifyOAuthQueryParams(oauthQuery, secret))) {
		return null;
	}
	const scopes = new Set((searchParams.get('scope') ?? '').split(' '));
	return {
		clientId,
		redirectUri,
		requestedScopes: Object.values(AGENT_SCOPE).filter((scope) => scopes.has(scope)),
		offlineAccess: scopes.has(OFFLINE_ACCESS_SCOPE),
		oauthQuery,
	};
}

/** The consent page for the request, or null when the client is unknown or disabled. */
export async function loadOauthConsent(
	userId: string,
	request: OauthConsentRequest,
): Promise<OauthConsentView | null> {
	const [client] = await getDb()
		.select({ ...OAUTH_CLIENT_DISPLAY_COLUMNS, disabled: oauthClient.disabled })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, request.clientId))
		.limit(1);
	if (client === undefined || client.disabled === true) {
		return null;
	}
	const existing = await findActiveOauthGrant(userId, request.clientId);
	return {
		client: oauthClientDisplay(client),
		redirectHost: URL.parse(request.redirectUri)?.host ?? request.redirectUri,
		requestedScopes: request.requestedScopes,
		selectedScopes: request.requestedScopes.filter((scope) => scope !== AGENT_SCOPE.read),
		wishlistIds: existing?.wishlistIds ?? null,
	};
}

/**
 * The CSP source the consent form's redirect lands on: the app's origin, or the scheme of a native
 * app's private-use redirect, which has no origin.
 */
export function redirectSourceOf(request: OauthConsentRequest): string | null {
	const target = URL.parse(request.redirectUri);
	if (target === null) {
		return null;
	}
	return target.origin === 'null' ? target.protocol : target.origin;
}

/** The scopes the user ticked, within what the app asked for; `read` comes with any request for it. */
export function acceptedScopes(
	request: Pick<OauthConsentRequest, 'requestedScopes'>,
	ticked: readonly string[],
): AgentScope[] {
	const chosen = new Set<string>(ticked);
	return request.requestedScopes.filter(
		(scope) => scope === AGENT_SCOPE.read || chosen.has(scope),
	);
}

/**
 * Records the grant, then the provider's consent, which answers with where the app continues.
 * The grant comes first so no consent ever exists without one; a grant this call created is
 * removed again when the consent fails.
 */
export async function acceptOauthConsent(input: {
	userId: string;
	request: OauthConsentRequest;
	scopes: readonly AgentScope[];
	wishlistIds: readonly string[] | null;
	/** Undefined accepts what the app asked for, which is how nothing is accepted for an empty request. */
	consent: (scope: string | undefined) => Promise<string>;
}): Promise<string> {
	const { userId, request, scopes, wishlistIds, consent } = input;
	const { grantId, created } = await saveOauthGrant(userId, request.clientId, {
		scopes,
		wishlistIds,
	});
	const tokenScopes = [...scopes, ...(request.offlineAccess ? [OFFLINE_ACCESS_SCOPE] : [])];
	try {
		return await consent(tokenScopes.length === 0 ? undefined : tokenScopes.join(' '));
	} catch (thrown) {
		if (created) {
			await deleteOauthGrant(grantId);
		}
		throw thrown;
	}
}
