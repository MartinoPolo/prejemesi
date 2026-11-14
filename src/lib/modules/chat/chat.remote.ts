import { error } from '@sveltejs/kit';
import {
	guardedCommand,
	guardedQuery,
	guardedQueryWithArgs,
	singleFlightRefresh,
} from '$lib/server/remote.js';
import { getDb } from '$lib/server/db/index.js';
import { requireLiveWishlistRowByShortId } from '$lib/server/operations/wishlist_management.js';
import {
	chatAvailability,
	isChatOfferedTo,
	usesChatRunner,
} from '$lib/server/chat/chat_availability.js';
import {
	chatMessageView,
	createChatSession,
	listChatSessions,
	readChatMessages,
	requireOwnChatSession,
	setChatFastForward,
} from '$lib/server/chat/chat_store.js';
import { stopChatRunnerTurn } from '$lib/server/chat/chat_runner_jobs.js';
import { activeChatTurnUrl } from '$lib/server/chat/chat_runner_turn.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	ChatFastForwardInputSchema,
	ChatSessionInputSchema,
	ChatStopInputSchema,
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

/** Whether this user's turns go to the chat runner, which lets them choose its model. */
export const getChatRunnerEnabled = guardedQuery(({ user }) => usesChatRunner(user.email));

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
			activeTurnUrl: await activeChatTurnUrl(session.id),
		};
	},
);

/**
 * Stop for a turn the chat runner answers, which a browser going away does not end. A model
 * provider's turn stops once its stream is aborted.
 */
export const stopChatTurn = guardedCommand(
	ChatStopInputSchema,
	async ({ user }, { sessionId, turnId }) => {
		requireChatUser(user);
		const session = await requireOwnChatSession(user.id, sessionId);
		await stopChatRunnerTurn(session.id, turnId ?? null);
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
