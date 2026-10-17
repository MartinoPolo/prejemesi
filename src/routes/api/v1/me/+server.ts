import type { RequestHandler } from './$types.js';
import { agentApiEndpoint } from '$lib/server/agent_access/api.js';

export const GET: RequestHandler = agentApiEndpoint(async ({ token }) => ({
	body: {
		user: { name: token.grant.userName },
		token: {
			name: token.grant.tokenName,
			prefix: token.prefix,
			scopes: token.grant.scopes,
			wishlistIds: token.grant.wishlistIds,
			expiresAt: token.expiresAt,
			fastForward: token.fastForward,
		},
	},
}));
