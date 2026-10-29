import type { RequestHandler } from './$types.js';
import { agentApiIdempotentJsonEndpoint } from '$lib/server/agent_access/api.js';
import { proposalSubmissionResponse } from '$lib/server/agent_access/endpoint_handlers.js';

export const POST: RequestHandler = agentApiIdempotentJsonEndpoint(({ caller, body }) =>
	proposalSubmissionResponse(caller, body.parsed),
);
