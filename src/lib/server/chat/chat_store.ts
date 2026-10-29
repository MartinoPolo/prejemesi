import { error } from '@sveltejs/kit';
import { and, asc, count, desc, eq, gt, gte, isNull, ne } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { chatMessage, chatSession } from '$lib/server/db/chat.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { wishlist } from '$lib/server/db/wishlist.schema.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CHAT_ROLE,
	type ChatMessageView,
	type ChatRole,
	type ChatSessionSummary,
} from '$lib/modules/chat/types.js';
import { CHAT_BLOCK, type ChatContentBlock } from './chat_model.js';
import { CHAT_RETENTION_MS } from './limits.js';

/** A chat's title: the start of its first message, on one line. */
const CHAT_TITLE_MAX_LENGTH = 80;

export interface StoredChatSession extends ChatSessionSummary {
	userId: string;
	wishlistId: string;
	wishlistShortId: string;
	wishlistTitle: string;
}

export interface StoredChatMessage {
	id: string;
	role: ChatRole;
	content: ChatContentBlock[];
	proposalId: string | null;
	createdAt: Date;
}

const sessionColumns = {
	id: chatSession.id,
	userId: chatSession.userId,
	wishlistId: chatSession.wishlistId,
	wishlistShortId: wishlist.shortId,
	wishlistTitle: wishlist.title,
	title: chatSession.title,
	fastForward: chatSession.fastForward,
	createdAt: chatSession.createdAt,
	lastTurnAt: chatSession.lastTurnAt,
};

function retainedSince(now: Date): Date {
	return new Date(now.getTime() - CHAT_RETENTION_MS);
}

export async function createChatSession(
	userId: string,
	wishlistId: string,
	now = new Date(),
): Promise<ChatSessionSummary> {
	const [created] = await getDb()
		.insert(chatSession)
		.values({ userId, wishlistId, title: '', createdAt: now, lastTurnAt: now })
		.returning({
			id: chatSession.id,
			title: chatSession.title,
			fastForward: chatSession.fastForward,
			createdAt: chatSession.createdAt,
			lastTurnAt: chatSession.lastTurnAt,
		});
	if (created === undefined) {
		throw new Error('Inserting the chat session returned no row');
	}
	return created;
}

/** The user's own retained chat on a live wishlist; any other is not found. */
export async function requireOwnChatSession(
	userId: string,
	sessionId: string,
	now = new Date(),
): Promise<StoredChatSession> {
	const [session] = await getDb()
		.select(sessionColumns)
		.from(chatSession)
		.innerJoin(wishlist, eq(wishlist.id, chatSession.wishlistId))
		.where(
			and(
				eq(chatSession.id, sessionId),
				eq(chatSession.userId, userId),
				gt(chatSession.lastTurnAt, retainedSince(now)),
				isNull(wishlist.deletedAt),
			),
		)
		.limit(1);
	if (session === undefined) {
		error(404, SERVER_ERROR.NOT_FOUND);
	}
	return session;
}

/** The user's chats about one wishlist, newest first; a chat never written in is not history. */
export async function listChatSessions(
	userId: string,
	wishlistId: string,
	now = new Date(),
): Promise<ChatSessionSummary[]> {
	return getDb()
		.select({
			id: chatSession.id,
			title: chatSession.title,
			fastForward: chatSession.fastForward,
			createdAt: chatSession.createdAt,
			lastTurnAt: chatSession.lastTurnAt,
		})
		.from(chatSession)
		.where(
			and(
				eq(chatSession.userId, userId),
				eq(chatSession.wishlistId, wishlistId),
				ne(chatSession.title, ''),
				gt(chatSession.lastTurnAt, retainedSince(now)),
			),
		)
		.orderBy(desc(chatSession.lastTurnAt));
}

export async function setChatFastForward(sessionId: string, fastForward: boolean): Promise<void> {
	await getDb().update(chatSession).set({ fastForward }).where(eq(chatSession.id, sessionId));
}

/** Every message of a chat, oldest first. */
export async function readChatMessages(sessionId: string): Promise<StoredChatMessage[]> {
	return getDb()
		.select({
			id: chatMessage.id,
			role: chatMessage.role,
			content: chatMessage.content,
			proposalId: chatMessage.proposalId,
			createdAt: chatMessage.createdAt,
		})
		.from(chatMessage)
		.where(eq(chatMessage.sessionId, sessionId))
		.orderBy(asc(chatMessage.sequence));
}

/** The latest messages, oldest first, starting with the user's so the model sees whole turns. */
export async function readRecentChatMessages(
	sessionId: string,
	limit: number,
): Promise<StoredChatMessage[]> {
	const newestFirst = await getDb()
		.select({
			id: chatMessage.id,
			role: chatMessage.role,
			content: chatMessage.content,
			proposalId: chatMessage.proposalId,
			createdAt: chatMessage.createdAt,
		})
		.from(chatMessage)
		.where(eq(chatMessage.sessionId, sessionId))
		.orderBy(desc(chatMessage.sequence))
		.limit(limit);
	const oldestFirst = newestFirst.reverse();
	const firstUserIndex = oldestFirst.findIndex((message) => message.role === CHAT_ROLE.user);
	return firstUserIndex === -1 ? [] : oldestFirst.slice(firstUserIndex);
}

function chatTitle(text: string): string {
	const oneLine = text.replace(/\s+/g, ' ').trim();
	return oneLine.length <= CHAT_TITLE_MAX_LENGTH
		? oneLine
		: `${oneLine.slice(0, CHAT_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/** The user's message starts a turn: the first one also names the chat. */
export async function storeUserMessage(
	session: Pick<StoredChatSession, 'id' | 'title'>,
	text: string,
	now = new Date(),
): Promise<void> {
	await getDb().transaction(async (transaction) => {
		await transaction.insert(chatMessage).values({
			sessionId: session.id,
			role: CHAT_ROLE.user,
			content: [{ type: CHAT_BLOCK.text, text }],
			createdAt: now,
		});
		await transaction
			.update(chatSession)
			.set({ lastTurnAt: now, ...(session.title === '' ? { title: chatTitle(text) } : {}) })
			.where(eq(chatSession.id, session.id));
	});
}

/** One model response: its text and tool calls, with the results of those calls. */
export async function storeAssistantMessage(
	sessionId: string,
	content: ChatContentBlock[],
	proposalId: string | null,
	now = new Date(),
): Promise<void> {
	await getDb().insert(chatMessage).values({
		sessionId,
		role: CHAT_ROLE.assistant,
		content,
		proposalId,
		createdAt: now,
	});
}

/**
 * The user's messages since `since`: one user's, or everyone's for the global cap. Demo
 * visitors chat with the scripted assistant, so their messages never count against the cap.
 */
export async function countUserMessagesSince(since: Date, userId: string | null): Promise<number> {
	const [row] = await getDb()
		.select({ total: count() })
		.from(chatMessage)
		.innerJoin(chatSession, eq(chatSession.id, chatMessage.sessionId))
		.innerJoin(user, eq(user.id, chatSession.userId))
		.where(
			and(
				eq(chatMessage.role, CHAT_ROLE.user),
				gte(chatMessage.createdAt, since),
				userId === null ? isNull(user.demoSessionId) : eq(chatSession.userId, userId),
			),
		);
	return row?.total ?? 0;
}

/** What the client shows of a message: text and tool names, never tool inputs or results. */
export function chatMessageView(message: StoredChatMessage): ChatMessageView {
	return {
		id: message.id,
		role: message.role,
		text: message.content
			.flatMap((block) => (block.type === CHAT_BLOCK.text ? [block.text] : []))
			.join(''),
		toolNames: message.content.flatMap((block) =>
			block.type === CHAT_BLOCK.toolCall ? [block.name] : [],
		),
		proposalId: message.proposalId,
		createdAt: message.createdAt,
	};
}
