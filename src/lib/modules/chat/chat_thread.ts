import {
	CHAT_ROLE,
	CHAT_STREAM_EVENT,
	type ChatMessageView,
	type ChatStreamEvent,
	type ChatTurnError,
} from './types.js';

const WEB_SEARCH_TOOL_NAME = 'web_search';

export const CHAT_TOOL_KIND = {
	search: 'search',
	read: 'read',
	change: 'change',
} as const;

export type ChatToolKind = (typeof CHAT_TOOL_KIND)[keyof typeof CHAT_TOOL_KIND];

/** Read operations are named by what they read; everything else the assistant calls proposes. */
const READ_TOOL_NAME = /^(?:read|get|list|search|find)[A-Z]/u;

export function chatToolKind(name: string): ChatToolKind {
	if (name === WEB_SEARCH_TOOL_NAME) {
		return CHAT_TOOL_KIND.search;
	}
	return READ_TOOL_NAME.test(name) ? CHAT_TOOL_KIND.read : CHAT_TOOL_KIND.change;
}

export interface ChatToolLine {
	kind: ChatToolKind;
	query: string | null;
}

export const CHAT_PART = {
	tools: 'tools',
	text: 'text',
	proposal: 'proposal',
} as const;

export type ChatPart =
	| { type: typeof CHAT_PART.tools; tools: ChatToolLine[] }
	| { type: typeof CHAT_PART.text; text: string }
	| { type: typeof CHAT_PART.proposal; proposalId: string };

export const CHAT_ITEM = { user: 'user', assistant: 'assistant' } as const;

export type ChatItem =
	| { type: typeof CHAT_ITEM.user; id: string; text: string }
	| { type: typeof CHAT_ITEM.assistant; id: string; parts: ChatPart[] };

/** Consecutive tool lines of one kind read as one line, the way a person would report them. */
function withToolLine(tools: readonly ChatToolLine[], line: ChatToolLine): ChatToolLine[] {
	const last = tools.at(-1);
	return last !== undefined && last.kind === line.kind && last.query === line.query
		? [...tools]
		: [...tools, line];
}

function messageParts(message: ChatMessageView): ChatPart[] {
	const tools = message.toolNames.reduce<ChatToolLine[]>(
		(lines, name) => withToolLine(lines, { kind: chatToolKind(name), query: null }),
		[],
	);
	return [
		...(tools.length > 0 ? [{ type: CHAT_PART.tools, tools }] : []),
		...(message.text.trim() === '' ? [] : [{ type: CHAT_PART.text, text: message.text }]),
		...(message.proposalId === null
			? []
			: [{ type: CHAT_PART.proposal, proposalId: message.proposalId }]),
	];
}

/** The stored messages as the panel shows them: one assistant item per answer, however many steps. */
export function chatThreadItems(messages: readonly ChatMessageView[]): ChatItem[] {
	const items: ChatItem[] = [];
	for (const message of messages) {
		const last = items.at(-1);
		if (message.role === CHAT_ROLE.user) {
			items.push({ type: CHAT_ITEM.user, id: message.id, text: message.text });
		} else if (last?.type === CHAT_ITEM.assistant) {
			last.parts = messageParts(message).reduce(withPart, last.parts);
		} else {
			items.push({
				type: CHAT_ITEM.assistant,
				id: message.id,
				parts: messageParts(message).reduce(withPart, []),
			});
		}
	}
	return items;
}

/**
 * The last answer did not finish: the chat ends with the user's message or a step that called
 * tools, the same rule the server uses to allow a retry.
 */
export function isChatTurnUnfinished(messages: readonly ChatMessageView[]): boolean {
	const last = messages.at(-1);
	return last !== undefined && (last.role === CHAT_ROLE.user || last.toolNames.length > 0);
}

/** The newest proposal in the chat, which the decision bar acts on. */
export function latestChatProposalId(messages: readonly ChatMessageView[]): string | null {
	return messages.filter((message) => message.proposalId !== null).at(-1)?.proposalId ?? null;
}

/** The turn being streamed, shown until the stored chat catches up with it. */
export interface LiveChatTurn {
	/** Null for a retry, whose message is already stored. */
	userText: string | null;
	parts: ChatPart[];
	error: ChatTurnError | null;
	/** A proposal arrived, so the turn may already have changed the list. */
	proposed: boolean;
}

export function startLiveChatTurn(userText: string | null): LiveChatTurn {
	return { userText, parts: [], error: null, proposed: false };
}

function withPart(parts: readonly ChatPart[], part: ChatPart): ChatPart[] {
	const last = parts.at(-1);
	if (part.type === CHAT_PART.text && last?.type === CHAT_PART.text) {
		return [...parts.slice(0, -1), { type: CHAT_PART.text, text: last.text + part.text }];
	}
	if (part.type === CHAT_PART.tools && last?.type === CHAT_PART.tools) {
		const tools = part.tools.reduce(withToolLine, last.tools);
		return [...parts.slice(0, -1), { type: CHAT_PART.tools, tools }];
	}
	return [...parts, part];
}

export function withStreamEvent(turn: LiveChatTurn, event: ChatStreamEvent): LiveChatTurn {
	switch (event.type) {
		case CHAT_STREAM_EVENT.text:
			return {
				...turn,
				parts: withPart(turn.parts, { type: CHAT_PART.text, text: event.text }),
			};
		case CHAT_STREAM_EVENT.tool:
			return {
				...turn,
				parts: withPart(turn.parts, {
					type: CHAT_PART.tools,
					tools: [{ kind: chatToolKind(event.name), query: event.query }],
				}),
			};
		case CHAT_STREAM_EVENT.proposal:
			return {
				...turn,
				proposed: true,
				parts: withPart(turn.parts, {
					type: CHAT_PART.proposal,
					proposalId: event.proposalId,
				}),
			};
		case CHAT_STREAM_EVENT.error:
			return { ...turn, error: event.error };
		case CHAT_STREAM_EVENT.done:
			return turn;
	}
}
