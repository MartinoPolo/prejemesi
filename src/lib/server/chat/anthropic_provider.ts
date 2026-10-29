import * as v from 'valibot';
import { serverSentEventData } from '$lib/modules/chat/server_sent_events.js';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_STOP_REASON,
	ChatProviderError,
	type ChatContentBlock,
	type ChatModelEvent,
	type ChatModelProvider,
	type ChatModelRequest,
	type ChatStopReason,
} from './chat_model.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search' } as const;
/** Bounds what one response may spend on searches. */
const WEB_SEARCH_MAX_USES = 5;

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

function anthropicContent(block: ChatContentBlock): Record<string, unknown> {
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
			{ ...WEB_SEARCH_TOOL, max_uses: WEB_SEARCH_MAX_USES },
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

const OPEN_BLOCK_KIND = { tool: 'tool', webSearch: 'webSearch' } as const;

/** A content block still streaming: a tool call's input arrives as JSON fragments. */
interface OpenToolBlock {
	kind: (typeof OPEN_BLOCK_KIND)[keyof typeof OPEN_BLOCK_KIND];
	id: string;
	name: string;
	inputJson: string;
}

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

function webSearchQuery(input: unknown): string | null {
	return typeof input === 'object' &&
		input !== null &&
		'query' in input &&
		typeof input.query === 'string'
		? input.query
		: null;
}

async function failureFor(response: Response): Promise<ChatProviderError> {
	const body = await response.text().catch(() => '');
	return new ChatProviderError(
		`The model API answered ${response.status}: ${body.slice(0, 300)}`,
		RETRYABLE_STATUSES.has(response.status),
	);
}

/** The Anthropic Messages API with the provider's own web search. */
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

const OPEN_BLOCK_KINDS: Readonly<Record<string, OpenToolBlock['kind']>> = {
	tool_use: OPEN_BLOCK_KIND.tool,
	server_tool_use: OPEN_BLOCK_KIND.webSearch,
};

function openedBlock(event: StreamEventOf<'content_block_start'>): OpenToolBlock | null {
	const { content_block: block } = event;
	const kind = OPEN_BLOCK_KINDS[block.type];
	return kind === undefined
		? null
		: { kind, id: block.id ?? '', name: block.name ?? '', inputJson: '' };
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
	return open.kind === OPEN_BLOCK_KIND.tool
		? { type: CHAT_MODEL_EVENT.toolCall, id: open.id, name: open.name, input }
		: { type: CHAT_MODEL_EVENT.webSearch, query: webSearchQuery(input) };
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
		let modelEvent: ChatModelEvent | null = null;
		switch (event?.type) {
			case 'content_block_start': {
				const opened = openedBlock(event);
				if (opened !== null) {
					openBlocks.set(event.index, opened);
				}
				break;
			}
			case 'content_block_delta':
				modelEvent = deltaEvent(event, openBlocks);
				break;
			case 'content_block_stop':
				modelEvent = closedBlockEvent(openBlocks.get(event.index));
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
		if (modelEvent !== null) {
			yield modelEvent;
		}
	}
	if (stopReason === null) {
		throw new ChatProviderError('The model stream ended without a stop reason', true);
	}
	yield { type: CHAT_MODEL_EVENT.stop, reason: stopReason };
}
