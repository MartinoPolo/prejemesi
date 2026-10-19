import type { RequestHandler } from './$types.js';
import { agentApiIdempotentJsonEndpoint } from '$lib/server/agent_access/api.js';
import { imageUploadResponse } from '$lib/server/agent_access/endpoint_handlers.js';

export const POST: RequestHandler = agentApiIdempotentJsonEndpoint(({ caller, body }, event) =>
	imageUploadResponse(caller, body.parsed, event.platform?.env.R2),
);
