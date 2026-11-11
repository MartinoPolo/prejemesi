import type { RequestHandler } from './$types.js';
import { handleChatRunnerMcp } from '$lib/server/chat/chat_runner_api.js';

// Only POST: the server offers no event stream, so SvelteKit answers GET with 405 as MCP expects.
export const POST: RequestHandler = (event) => handleChatRunnerMcp(event);
