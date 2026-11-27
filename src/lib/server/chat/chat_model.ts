import type {
	ChatRole,
	ChatToolDebug,
	ChatToolError,
	ChatToolSummary,
	ChatWebToolName,
} from '$lib/modules/chat/types.js';

export { CHAT_ROLE, type ChatRole } from '$lib/modules/chat/types.js';

/**
 * The provider-neutral conversation the chat sends to a model. Provider-specific blocks (web
 * search results, citations) stay inside the adapter, which reports only the page addresses they
 * name; history keeps only text and tool calls, so switching providers is configuration.
 */

export const CHAT_BLOCK = {
	text: 'text',
	toolCall: 'toolCall',
	toolResult: 'toolResult',
	webTool: 'webTool',
} as const;

/**
 * A web tool the provider or Claude Code ran itself, kept only for the chat's tool lines and
 * never sent back to a model. `debug` holds its truncated raw input and result for the owner's
 * debug view, when the tool's runner reported them.
 */
export interface ChatWebToolRecord {
	type: typeof CHAT_BLOCK.webTool;
	id: string;
	name: ChatWebToolName;
	query: string | null;
	isError: boolean;
	error: ChatToolError | null;
	summary: ChatToolSummary | null;
	durationMs: number | null;
	debug: ChatToolDebug | null;
}

/** What a model reads; `durationMs` of a result is for the tool lines only. */
export type ChatModelContentBlock =
	| { type: typeof CHAT_BLOCK.text; text: string }
	| { type: typeof CHAT_BLOCK.toolCall; id: string; name: string; input: unknown }
	| {
			type: typeof CHAT_BLOCK.toolResult;
			toolCallId: string;
			content: string;
			isError: boolean;
			durationMs?: number;
	  };

export type ChatContentBlock = ChatModelContentBlock | ChatWebToolRecord;

export function isChatModelContentBlock(block: ChatContentBlock): block is ChatModelContentBlock {
	return block.type !== CHAT_BLOCK.webTool;
}

export interface ChatModelMessage {
	role: ChatRole;
	content: ChatModelContentBlock[];
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
	webTool: 'webTool',
	webToolResult: 'webToolResult',
	webSources: 'webSources',
	stop: 'stop',
} as const;

export type ChatModelEvent =
	| { type: typeof CHAT_MODEL_EVENT.textDelta; text: string }
	| { type: typeof CHAT_MODEL_EVENT.toolCall; id: string; name: string; input: unknown }
	/**
	 * The provider's own web tool started; `query` (search query or page URL) may be unknown.
	 * `debugInput` is its truncated raw input.
	 */
	| {
			type: typeof CHAT_MODEL_EVENT.webTool;
			id: string;
			name: ChatWebToolName;
			query: string | null;
			debugInput: string;
	  }
	/** The provider's web tool `id` finished; `debugResult` is a truncated raw result. */
	| {
			type: typeof CHAT_MODEL_EVENT.webToolResult;
			id: string;
			error: ChatToolError | null;
			summary: ChatToolSummary | null;
			debugResult: string;
	  }
	/** Page addresses the provider's web search found or its web fetch read. */
	| { type: typeof CHAT_MODEL_EVENT.webSources; urls: string[] }
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
