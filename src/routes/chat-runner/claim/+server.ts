import type { RequestHandler } from './$types.js';
import { handleChatRunnerClaim } from '$lib/server/chat/chat_runner_api.js';

// Outside /api: the edge challenge guarding the agent API would block the runner.
export const POST: RequestHandler = (event) => handleChatRunnerClaim(event);
