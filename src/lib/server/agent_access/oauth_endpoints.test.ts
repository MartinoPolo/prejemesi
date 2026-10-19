import { describe, expect, it } from 'vitest';
import { needsOauthProvider, oauthEndpoints } from './oauth_endpoints.js';

describe('needsOauthProvider', () => {
	it.each([
		'/api/auth/oauth2/authorize',
		'/api/auth/get-session',
		'/.well-known/oauth-authorization-server/api/auth',
		'/.well-known/oauth-protected-resource/mcp',
		'/oauth/consent',
		'/mcp',
	])('loads the provider for %s', (pathname) => {
		expect(needsOauthProvider(pathname)).toBe(true);
	});

	it.each([
		'/',
		'/login',
		'/my-lists',
		'/settings',
		'/api/v1/me',
		'/api/auth',
		'/mcp/tools',
		'/oauth/consent/other',
		'/en/oauth/consent',
		'/well-known/oauth-protected-resource',
	])('skips the provider for %s', (pathname) => {
		expect(needsOauthProvider(pathname)).toBe(false);
	});
});

describe('oauthEndpoints', () => {
	it('binds tokens to /mcp and points discovery at its protected-resource metadata', () => {
		expect(oauthEndpoints('https://prejemesi.cz')).toEqual({
			issuer: 'https://prejemesi.cz/api/auth',
			resource: 'https://prejemesi.cz/mcp',
			resourceMetadataUrl: 'https://prejemesi.cz/.well-known/oauth-protected-resource/mcp',
		});
	});
});
