import * as v from 'valibot';
import { serverSentEventData } from '$lib/modules/chat/server_sent_events.js';
import {
	CHAT_BROWSE_TOOL,
	CHAT_TOOL_SUMMARY,
	CHAT_WEB_TOOL,
	type ChatToolError,
	type ChatToolSummary,
	type ChatWebToolName,
} from '$lib/modules/chat/types.js';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_STOP_REASON,
	ChatProviderError,
	type ChatModelContentBlock,
	type ChatModelEvent,
	type ChatModelProvider,
	type ChatModelRequest,
	type ChatModelTool,
	type ChatStopReason,
} from './chat_model.js';
import { urlsInText } from './browse_page.js';
import { debugInputText, truncatedDebugText } from './chat_tool_outcome.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Bounds what one response may spend on each web tool. */
const WEB_TOOL_MAX_USES = 5;
/** Bounds how much of one fetched page enters the context. */
const WEB_FETCH_MAX_CONTENT_TOKENS = 20_000;
/**
 * The provider's web tools, in basic versions: newer ones filter results through code execution,
 * which the chat does not use. Web fetch counts addresses in client tool results as in the
 * conversation, but the model writes gift data, which persists, so only `browse_page` results (page
 * text third-party sites wrote) count, as in `conversationUrls`.
 */
function webTools(tools: readonly ChatModelTool[]) {
	const offersBrowsePage = tools.some((tool) => tool.name === CHAT_BROWSE_TOOL);
	return [
		{ type: 'web_search_20250305', name: CHAT_WEB_TOOL.search, max_uses: WEB_TOOL_MAX_USES },
		{
			type: 'web_fetch_20250910',
			name: CHAT_WEB_TOOL.fetch,
			max_uses: WEB_TOOL_MAX_USES,
			max_content_tokens: WEB_FETCH_MAX_CONTENT_TOKENS,
			url_sources: {
				client_tool_results: offersBrowsePage
					? { type: 'only', tools: [{ type: 'tool_reference', name: CHAT_BROWSE_TOOL }] }
					: { type: 'none' },
			},
		},
	];
}

/** The input field holding what a web tool started on: the search query or the page URL. */
const WEB_TOOL_QUERY_FIELDS: Readonly<Record<ChatWebToolName, string>> = {
	[CHAT_WEB_TOOL.search]: 'query',
	[CHAT_WEB_TOOL.fetch]: 'url',
};

/** Rate limits, server errors and 529 (overloaded) pass; other failures are the request's own fault. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

const STOP_REASONS: Readonly<Record<string, ChatStopReason>> = {
	end_turn: CHAT_STOP_REASON.endTurn,
	stop_sequence: CHAT_STOP_REASON.endTurn,
	tool_use: CHAT_STOP_REASON.toolUse,
	max_tokens: CHAT_STOP_REASON.maxTokens,
	pause_turn: CHAT_STOP_REASON.paused,
	refusal: CHAT_STOP_REASON.refusal,
};

export interface AnthropicProviderOptions {
	apiKey: string;
	model: string;
	fetch?: typeof fetch;
}

function anthropicContent(block: ChatModelContentBlock): Record<string, unknown> {
	switch (block.type) {
		case CHAT_BLOCK.text:
			return { type: 'text', text: block.text };
		case CHAT_BLOCK.toolCall:
			return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
		case CHAT_BLOCK.toolResult:
			return {
				type: 'tool_result',
				tool_use_id: block.toolCallId,
				content: block.content,
				is_error: block.isError,
			};
	}
}

/** The Messages API request body for one streamed response. */
export function anthropicRequestBody(model: string, request: ChatModelRequest) {
	return {
		model,
		max_tokens: request.maxOutputTokens,
		stream: true,
		system: request.system,
		messages: request.messages.map((message) => ({
			role: message.role,
			content: message.content.map(anthropicContent),
		})),
		tools: [
			...request.tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				input_schema: tool.inputSchema,
			})),
			...webTools(request.tools),
		],
	};
}

const StreamEventSchema = v.variant('type', [
	v.object({
		type: v.literal('content_block_start'),
		index: v.number(),
		content_block: v.looseObject({
			type: v.string(),
			id: v.optional(v.string()),
			name: v.optional(v.string()),
			content: v.optional(v.unknown()),
		}),
	}),
	v.object({
		type: v.literal('content_block_delta'),
		index: v.number(),
		delta: v.looseObject({
			type: v.string(),
			text: v.optional(v.string()),
			partial_json: v.optional(v.string()),
		}),
	}),
	v.object({ type: v.literal('content_block_stop'), index: v.number() }),
	v.object({
		type: v.literal('message_delta'),
		delta: v.looseObject({ stop_reason: v.nullish(v.string()) }),
	}),
	v.object({
		type: v.literal('error'),
		error: v.looseObject({ type: v.string(), message: v.optional(v.string()) }),
	}),
	v.object({ type: v.literal('message_start') }),
	v.object({ type: v.literal('message_stop') }),
	v.object({ type: v.literal('ping') }),
]);

type StreamEvent = v.InferOutput<typeof StreamEventSchema>;

/** A web search or fetch result names its page; an error result has no `url` and is skipped. */
const WebResultSchema = v.looseObject({ type: v.string(), url: v.optional(v.string()) });
/** The page a fetch result read, as a document: plain text, or an encoded PDF naming no address. */
const FetchedTextDocumentSchema = v.looseObject({
	source: v.looseObject({ type: v.literal('text'), data: v.string() }),
});
/** A fetch result that read a text page; an encoded PDF has no character count to report. */
const FetchResultSchema = v.looseObject({ content: FetchedTextDocumentSchema });
const WEB_RESULT_BLOCK_ITEM_TYPES: Readonly<Record<string, string>> = {
	web_search_tool_result: 'web_search_result',
	web_fetch_tool_result: 'web_fetch_result',
};

function parseStreamEvent(data: string): StreamEvent | null {
	let json: unknown;
	try {
		json = JSON.parse(data);
	} catch {
		throw new ChatProviderError('The model stream sent invalid JSON', true);
	}
	const parsed = v.safeParse(StreamEventSchema, json);
	// Event types this adapter does not use (a future addition) are skipped, not failures.
	return parsed.success ? parsed.output : null;
}

/** A content block still streaming: a tool call's input arrives as JSON fragments. */
type OpenToolBlock =
	| { kind: 'tool'; id: string; name: string; inputJson: string }
	| { kind: 'webTool'; id: string; name: ChatWebToolName; inputJson: string };

function parseToolInput(inputJson: string): unknown {
	if (inputJson.trim() === '') {
		return {};
	}
	try {
		return JSON.parse(inputJson);
	} catch {
		throw new ChatProviderError('The model sent an incomplete tool call', true);
	}
}

function isWebToolName(name: string): name is ChatWebToolName {
	return Object.hasOwn(WEB_TOOL_QUERY_FIELDS, name);
}

function webToolQuery(name: ChatWebToolName, input: unknown): string | null {
	if (typeof input !== 'object' || input === null) {
		return null;
	}
	const query: unknown = Reflect.get(input, WEB_TOOL_QUERY_FIELDS[name]);
	return typeof query === 'string' ? query : null;
}

async function failureFor(response: Response): Promise<ChatProviderError> {
	const body = await response.text().catch(() => '');
	return new ChatProviderError(
		`The model API answered ${response.status}: ${body.slice(0, 300)}`,
		RETRYABLE_STATUSES.has(response.status),
	);
}

/** The Anthropic Messages API with the provider's own web search and page fetch. */
export function createAnthropicProvider(options: AnthropicProviderOptions): ChatModelProvider {
	const fetchModel = options.fetch ?? fetch;
	return {
		async *stream(request, signal) {
			const response = await fetchModel(ANTHROPIC_MESSAGES_URL, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-api-key': options.apiKey,
					'anthropic-version': ANTHROPIC_VERSION,
				},
				body: JSON.stringify(anthropicRequestBody(options.model, request)),
				signal,
			});
			if (!response.ok || response.body === null) {
				throw await failureFor(response);
			}
			yield* modelEvents(response.body);
		},
	};
}

type StreamEventOf<Type extends StreamEvent['type']> = Extract<StreamEvent, { type: Type }>;

/** Server tools the adapter does not know (a future addition) stay closed and are skipped. */
function openedBlock(event: StreamEventOf<'content_block_start'>): OpenToolBlock | null {
	const { content_block: block } = event;
	const name = block.name ?? '';
	if (block.type === 'tool_use') {
		return { kind: 'tool', id: block.id ?? '', name, inputJson: '' };
	}
	if (block.type === 'server_tool_use' && isWebToolName(name)) {
		return { kind: 'webTool', id: block.id ?? '', name, inputJson: '' };
	}
	return null;
}

/** The addresses written in the text of the page a fetch result read. */
function urlsInFetchedText(result: v.InferOutput<typeof WebResultSchema>): string[] {
	const document = v.safeParse(FetchedTextDocumentSchema, result['content']);
	return document.success ? [...urlsInText(document.output.source.data)] : [];
}

/**
 * The page addresses of a web search or fetch result block, which arrives whole at its start: a
 * search result holds a list of pages, a fetch result the one page it read and the addresses in its
 * text.
 */
function webSourcesEvent(event: StreamEventOf<'content_block_start'>): ChatModelEvent | null {
	const { content_block: block } = event;
	const itemType = WEB_RESULT_BLOCK_ITEM_TYPES[block.type];
	if (itemType === undefined) {
		return null;
	}
	const items = Array.isArray(block.content) ? block.content : [block.content];
	const urls = items.flatMap((item) => {
		const parsed = v.safeParse(WebResultSchema, item);
		return parsed.success && parsed.output.type === itemType && parsed.output.url !== undefined
			? [parsed.output.url, ...urlsInFetchedText(parsed.output)]
			: [];
	});
	return urls.length === 0 ? null : { type: CHAT_MODEL_EVENT.webSources, urls };
}

/** A failed web tool's result is one error object naming its code, such as `url_not_accessible`. */
const WebToolErrorSchema = v.looseObject({
	type: v.pipe(v.string(), v.endsWith('_error')),
	error_code: v.string(),
});

function webResultSummary(
	block: StreamEventOf<'content_block_start'>['content_block'],
): ChatToolSummary | null {
	if (block.type === 'web_search_tool_result') {
		return Array.isArray(block.content)
			? { kind: CHAT_TOOL_SUMMARY.searchResults, count: block.content.length }
			: null;
	}
	const fetched = v.safeParse(FetchResultSchema, block.content);
	return fetched.success
		? {
				kind: CHAT_TOOL_SUMMARY.page,
				characters: fetched.output.content.source.data.length,
				truncated: false,
			}
		: null;
}

/** How a web search or fetch went: its result block names the call it answers. */
function webToolResultEvent(event: StreamEventOf<'content_block_start'>): ChatModelEvent | null {
	const { content_block: block } = event;
	const toolUseId = block['tool_use_id'];
	if (WEB_RESULT_BLOCK_ITEM_TYPES[block.type] === undefined || typeof toolUseId !== 'string') {
		return null;
	}
	const failure = v.safeParse(WebToolErrorSchema, block.content);
	const error: ChatToolError | null = failure.success
		? { code: failure.output.error_code, message: null }
		: null;
	return {
		type: CHAT_MODEL_EVENT.webToolResult,
		id: toolUseId,
		error,
		summary: error === null ? webResultSummary(block) : null,
		debugResult: truncatedDebugText(JSON.stringify(block.content ?? null)),
	};
}

/** A text delta becomes an event; a tool input fragment extends its open block. */
function deltaEvent(
	event: StreamEventOf<'content_block_delta'>,
	openBlocks: ReadonlyMap<number, OpenToolBlock>,
): ChatModelEvent | null {
	const { delta } = event;
	if (delta.type === 'text_delta') {
		return (delta.text ?? '') === ''
			? null
			: { type: CHAT_MODEL_EVENT.textDelta, text: delta.text ?? '' };
	}
	const open = openBlocks.get(event.index);
	if (delta.type === 'input_json_delta' && open !== undefined) {
		open.inputJson += delta.partial_json ?? '';
	}
	return null;
}

function closedBlockEvent(open: OpenToolBlock | undefined): ChatModelEvent | null {
	if (open === undefined) {
		return null;
	}
	const input = parseToolInput(open.inputJson);
	return open.kind === 'tool'
		? { type: CHAT_MODEL_EVENT.toolCall, id: open.id, name: open.name, input }
		: {
				type: CHAT_MODEL_EVENT.webTool,
				id: open.id,
				name: open.name,
				query: webToolQuery(open.name, input),
				debugInput: debugInputText(input),
			};
}

function streamFailure(event: StreamEventOf<'error'>): ChatProviderError {
	const { type } = event.error;
	return new ChatProviderError(
		`The model stream failed: ${type}`,
		type === 'overloaded_error' || type === 'api_error',
	);
}

async function* modelEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatModelEvent> {
	const openBlocks = new Map<number, OpenToolBlock>();
	let stopReason: ChatStopReason | null = null;
	for await (const data of serverSentEventData(body)) {
		const event = parseStreamEvent(data);
		let blockEvents: (ChatModelEvent | null)[] = [];
		switch (event?.type) {
			case 'content_block_start': {
				const opened = openedBlock(event);
				if (opened !== null) {
					openBlocks.set(event.index, opened);
				}
				blockEvents = [webSourcesEvent(event), webToolResultEvent(event)];
				break;
			}
			case 'content_block_delta':
				blockEvents = [deltaEvent(event, openBlocks)];
				break;
			case 'content_block_stop':
				blockEvents = [closedBlockEvent(openBlocks.get(event.index))];
				openBlocks.delete(event.index);
				break;
			case 'message_delta':
				stopReason = STOP_REASONS[event.delta.stop_reason ?? ''] ?? stopReason;
				break;
			case 'error':
				throw streamFailure(event);
			default:
				break;
		}
		for (const modelEvent of blockEvents) {
			if (modelEvent !== null) {
				yield modelEvent;
			}
		}
	}
	if (stopReason === null) {
		throw new ChatProviderError('The model stream ended without a stop reason', true);
	}
	yield { type: CHAT_MODEL_EVENT.stop, reason: stopReason };
}
