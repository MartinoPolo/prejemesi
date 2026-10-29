import type { RequestHandler } from './$types.js';
import { buildAgentApiDocument } from '$lib/server/agent_access/openapi.js';

export const GET: RequestHandler = ({ url }) =>
	Response.json(buildAgentApiDocument(url.origin), {
		headers: { 'cache-control': 'public, max-age=300' },
	});
