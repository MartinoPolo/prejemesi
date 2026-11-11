import type { RequestHandler } from './$types.js';
import { handleChatTurnContinuation } from '$lib/server/chat/chat_endpoint.js';

// A chat runner turn's stream after its `continue` event.
export const GET: RequestHandler = (event) => handleChatTurnContinuation(event);
