import type { RequestHandler } from './$types.js';
import { handleMcpRequest } from '$lib/server/agent_access/mcp_server.js';

// Only POST: the server offers no event stream, so SvelteKit answers GET with 405 as MCP expects.
export const POST: RequestHandler = (event) => handleMcpRequest(event);
