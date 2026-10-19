import type { RequestHandler } from './$types.js';
import { agentApiJsonEndpoint } from '$lib/server/agent_access/api.js';
import { operationReadResponse } from '$lib/server/agent_access/endpoint_handlers.js';

export const POST: RequestHandler = agentApiJsonEndpoint(({ caller, body }, { params }) =>
	operationReadResponse(caller, params.operationName, body.parsed),
);
