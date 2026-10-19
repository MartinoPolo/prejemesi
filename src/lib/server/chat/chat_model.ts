import type { ChatRole } from '$lib/modules/chat/types.js';

export { CHAT_ROLE, type ChatRole } from '$lib/modules/chat/types.js';

/**
 * The provider-neutral conversation the chat sends to a model. Provider-specific blocks (web
 * search results, citations) stay inside the adapter; history keeps only text and tool calls, so
 * switching providers is configuration.
 */

export const CHAT_BLOCK = {
	text: 'text',
	toolCall: 'toolCall',
	toolResult: 'toolResult',
} as const;

export type ChatContentBlock =
	| { type: typeof CHAT_BLOCK.text; text: string }
	| { type: typeof CHAT_BLOCK.toolCall; id: string; name: string; input: unknown }
	| { type: typeof CHAT_BLOCK.toolResult; toolCallId: string; content: string; isError: boolean };

export interface ChatModelMessage {
	role: ChatRole;
	content: ChatContentBlock[];
}

/** A tool the model may call; `inputSchema` is a JSON Schema object. */
export interface ChatModelTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface ChatModelRequest {
	system: string;
	messages: readonly ChatModelMessage[];
	tools: readonly ChatModelTool[];
	maxOutputTokens: number;
}

export const CHAT_STOP_REASON = {
	endTurn: 'endTurn',
	toolUse: 'toolUse',
	maxTokens: 'maxTokens',
	/** The provider paused a long server-side tool run; the turn ends with what it has. */
	paused: 'paused',
	refusal: 'refusal',
} as const;

export type ChatStopReason = (typeof CHAT_STOP_REASON)[keyof typeof CHAT_STOP_REASON];

export const CHAT_MODEL_EVENT = {
	textDelta: 'textDelta',
	toolCall: 'toolCall',
	webSearch: 'webSearch',
	stop: 'stop',
} as const;

export type ChatModelEvent =
	| { type: typeof CHAT_MODEL_EVENT.textDelta; text: string }
	| { type: typeof CHAT_MODEL_EVENT.toolCall; id: string; name: string; input: unknown }
	/** The provider's own web search started; `query` is null until the provider names it. */
	| { type: typeof CHAT_MODEL_EVENT.webSearch; query: string | null }
	| { type: typeof CHAT_MODEL_EVENT.stop; reason: ChatStopReason };

/** A model behind the chat: streams one response to the conversation so far. */
export interface ChatModelProvider {
	stream(request: ChatModelRequest, signal: AbortSignal): AsyncIterable<ChatModelEvent>;
}

/** The provider failed or answered something the adapter cannot read; nothing was applied. */
export class ChatProviderError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
		this.name = 'ChatProviderError';
	}
}
