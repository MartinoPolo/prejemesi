import { error } from '@sveltejs/kit';
import {
	guardedCommand,
	guardedQuery,
	guardedQueryWithArgs,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { getDb } from '$lib/server/db/index.js';
import { requireLiveWishlistRowByShortId } from '$lib/server/operations/wishlist_management.js';
import { chatAvailability, isChatOfferedTo } from '$lib/server/chat/chat_availability.js';
import {
	chatMessageView,
	createChatSession,
	listChatSessions,
	readChatMessages,
	requireOwnChatSession,
	setChatFastForward,
} from '$lib/server/chat/chat_store.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	ChatFastForwardInputSchema,
	ChatSessionInputSchema,
	ChatWishlistInputSchema,
	type ChatSessionView,
} from './types.js';

// Thin adapters for the chat panel; turns stream from POST /chat/<sessionId>/turns.

/** Caps and the kill switch leave history readable; only the chat being offered at all counts. */
function requireChatUser(user: { email: string }): void {
	if (!isChatOfferedTo(user.email)) {
		error(403, SERVER_ERROR.FORBIDDEN);
	}
}

export const getChatAvailability = guardedQuery(({ user }) => chatAvailability(user));

export const getChatSessions = guardedQueryWithArgs(
	ChatWishlistInputSchema,
	async ({ user }, { wishlistShortId }) => {
		requireChatUser(user);
		const wishlist = await requireLiveWishlistRowByShortId(getDb(), wishlistShortId);
		return listChatSessions(user.id, wishlist.id);
	},
);

export const getChatSession = guardedQueryWithArgs(
	ChatSessionInputSchema,
	async ({ user }, { sessionId }): Promise<ChatSessionView> => {
		requireChatUser(user);
		const session = await requireOwnChatSession(user.id, sessionId);
		const messages = await readChatMessages(session.id);
		return {
			id: session.id,
			title: session.title,
			fastForward: session.fastForward,
			createdAt: session.createdAt,
			lastTurnAt: session.lastTurnAt,
			wishlistShortId: session.wishlistShortId,
			messages: messages.map(chatMessageView),
		};
	},
);

/** A new chat starts with fast-forward off; it joins the history once written in. */
export const startChatSession = guardedCommand(
	ChatWishlistInputSchema,
	async ({ user }, { wishlistShortId }) => {
		requireChatUser(user);
		const wishlist = await requireLiveWishlistRowByShortId(getDb(), wishlistShortId);
		return createChatSession(user.id, wishlist.id);
	},
);

export const setChatSessionFastForward = guardedCommand(
	ChatFastForwardInputSchema,
	async ({ user }, { sessionId, fastForward }) => {
		requireChatUser(user);
		const session = await requireOwnChatSession(user.id, sessionId);
		await setChatFastForward(session.id, fastForward);
		await singleFlightRefresh(getChatSession, { sessionId });
	},
);
