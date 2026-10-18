import type { RequestHandler } from './$types.js';
import { agentApiEndpoint } from '$lib/server/agent_access/api.js';
import { proposalResponse } from '$lib/server/agent_access/endpoint_handlers.js';

export const GET: RequestHandler = agentApiEndpoint(({ token }, { params }) =>
	proposalResponse(token, params.proposalId),
);
