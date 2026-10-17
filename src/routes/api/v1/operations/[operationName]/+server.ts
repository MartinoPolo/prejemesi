import type { RequestHandler } from './$types.js';
import { agentApiJsonEndpoint, runAgentApiOperation } from '$lib/server/agent_access/api.js';

export const POST: RequestHandler = agentApiJsonEndpoint(async ({ token, body }, { params }) => ({
	body: { result: await runAgentApiOperation(token.grant, params.operationName, body.parsed) },
}));
