import type { RequestHandler } from './$types.js';
import { handleChatTurnRequest } from '$lib/server/chat/chat_endpoint.js';

// Outside /api: the edge challenge guarding the agent API would block a browser's stream.
export const POST: RequestHandler = (event) => handleChatTurnRequest(event);
