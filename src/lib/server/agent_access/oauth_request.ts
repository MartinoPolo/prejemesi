import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { resolveApplicationOrigin } from '$lib/config/runtime_environment.js';
import { createAuth } from '$lib/server/auth.js';
import { createOauthAccessVerifier, type OauthAccessVerifier } from './oauth_access.js';
import { oauthEndpoints } from './oauth_endpoints.js';

/**
 * The verifier for the request's origin. The key set comes from BetterAuth in-process rather
 * than over HTTP from this same Worker.
 */
export function createRequestOauthVerifier(event: RequestEvent): OauthAccessVerifier {
	const endpoints = oauthEndpoints(
		resolveApplicationOrigin(env, import.meta.env.DEV, event.url.href),
	);
	return createOauthAccessVerifier(endpoints, () =>
		createAuth(event).api.getJwks({ headers: event.request.headers }),
	);
}
