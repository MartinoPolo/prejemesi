import type { RequestHandler } from './$types.js';
import { agentApiEndpoint } from '$lib/server/agent_access/api.js';
import { proposalApplyResponse } from '$lib/server/agent_access/endpoint_handlers.js';

export const POST: RequestHandler = agentApiEndpoint(({ token }, { params }) =>
	proposalApplyResponse(token, params.proposalId),
);
