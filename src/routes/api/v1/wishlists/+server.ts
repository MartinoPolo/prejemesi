import type { RequestHandler } from './$types.js';
import { agentApiEndpoint, runAgentApiOperation } from '$lib/server/agent_access/api.js';
import { readAccessibleWishlistsOperation } from '$lib/server/operations/wishlist_read_operations.js';

export const GET: RequestHandler = agentApiEndpoint(async ({ token }) => ({
	body: {
		wishlists: await runAgentApiOperation(
			token.grant,
			readAccessibleWishlistsOperation.name,
			{},
		),
	},
}));
