import type { RequestHandler } from './$types.js';
import { agentApiIdempotentJsonEndpoint } from '$lib/server/agent_access/api.js';
import { submitChangeProposal } from '$lib/server/agent_access/change_proposal_api.js';

export const POST: RequestHandler = agentApiIdempotentJsonEndpoint(async ({ token, body }) => ({
	body: { proposal: await submitChangeProposal(token, body.parsed) },
	status: 201,
}));
