import type { ChatSessionView } from '$lib/modules/chat/types.js';
import { usesChatRunner } from './chat_availability.js';
import { activeChatTurnUrl } from './chat_runner_turn.js';
import { chatMessageView, readChatMessages, requireOwnChatSession } from './chat_store.js';

/**
 * The user's own chat as its panel shows it. Only the chat runner's users, the app's owner, get
 * each tool call's raw input and result for debugging.
 */
export async function readChatSessionView(
	user: { id: string; email: string },
	sessionId: string,
): Promise<ChatSessionView> {
	const session = await requireOwnChatSession(user.id, sessionId);
	const messages = await readChatMessages(session.id);
	const includeDebug = usesChatRunner(user.email);
	return {
		id: session.id,
		title: session.title,
		fastForward: session.fastForward,
		createdAt: session.createdAt,
		lastTurnAt: session.lastTurnAt,
		wishlistShortId: session.wishlistShortId,
		messages: messages.map((message) => chatMessageView(message, { includeDebug })),
		activeTurnUrl: await activeChatTurnUrl(session.id),
	};
}
