import type { RequestHandler } from './$types.js';
import { handleChatRunnerEvents } from '$lib/server/chat/chat_runner_api.js';

export const POST: RequestHandler = (event) => handleChatRunnerEvents(event);
