import { AGENT_MCP_PATH } from './api_paths.js';

/** Where BetterAuth serves its routes, so also the OAuth issuer below the application origin. */
const AUTH_BASE_PATH = '/api/auth';

/** Where a signed-in user decides what an app may do, as BetterAuth's `consentPage`. */
export const OAUTH_CONSENT_PATH = '/oauth/consent';

/** The OAuth scope that makes the provider issue a refresh token, so an app stays connected. */
export const OFFLINE_ACCESS_SCOPE = 'offline_access';

const WELL_KNOWN_PATH = '/.well-known/';
const PROTECTED_RESOURCE_METADATA_PATH = `${WELL_KNOWN_PATH}oauth-protected-resource`;

/**
 * The requests that need the OAuth provider: its auth routes and discovery, consent, and MCP
 * token verification. Every other request skips it, because the provider reads its resource
 * row whenever BetterAuth starts.
 */
export function needsOauthProvider(pathname: string): boolean {
	return (
		pathname.startsWith(`${AUTH_BASE_PATH}/`) ||
		pathname.startsWith(WELL_KNOWN_PATH) ||
		pathname === OAUTH_CONSENT_PATH ||
		pathname === AGENT_MCP_PATH
	);
}

/**
 * The OAuth identifiers of one application origin. MCP clients bind tokens to `resource` and
 * discover the authorization server from `resourceMetadataUrl`; tokens carry `issuer`.
 */
export function oauthEndpoints(applicationOrigin: string) {
	return {
		issuer: `${applicationOrigin}${AUTH_BASE_PATH}`,
		resource: `${applicationOrigin}${AGENT_MCP_PATH}`,
		resourceMetadataUrl: `${applicationOrigin}${PROTECTED_RESOURCE_METADATA_PATH}${AGENT_MCP_PATH}`,
	};
}

export type OauthEndpoints = ReturnType<typeof oauthEndpoints>;
