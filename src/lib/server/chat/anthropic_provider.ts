import * as v from 'valibot';
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

/** 429, 500, 503 and 529 (overloaded) pass; other failures are the request's own fault. */
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

/** The `data:` payloads of a server-sent event stream, one per event. */
async function* serverSentEventData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffered = '';
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffered += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
			let boundary = buffered.indexOf('\n\n');
			while (boundary !== -1) {
				const data = eventData(buffered.slice(0, boundary));
				buffered = buffered.slice(boundary + 2);
				if (data !== null) {
					yield data;
				}
				boundary = buffered.indexOf('\n\n');
			}
		}
		const trailing = eventData(buffered);
		if (trailing !== null) {
			yield trailing;
		}
	} finally {
		reader.releaseLock();
	}
}

function eventData(rawEvent: string): string | null {
	const dataLines = rawEvent
		.split('\n')
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice('data:'.length).trimStart());
	return dataLines.length === 0 ? null : dataLines.join('\n');
}

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

async function* modelEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatModelEvent> {
	const openBlocks = new Map<number, OpenToolBlock>();
	let stopReason: ChatStopReason | null = null;
	for await (const data of serverSentEventData(body)) {
		const event = parseStreamEvent(data);
		if (event === null) {
			continue;
		}
		switch (event.type) {
			case 'content_block_start': {
				const { content_block: block } = event;
				if (block.type === 'tool_use' || block.type === 'server_tool_use') {
					openBlocks.set(event.index, {
						kind:
							block.type === 'tool_use'
								? OPEN_BLOCK_KIND.tool
								: OPEN_BLOCK_KIND.webSearch,
						id: block.id ?? '',
						name: block.name ?? '',
						inputJson: '',
					});
				}
				break;
			}
			case 'content_block_delta': {
				const { delta } = event;
				if (delta.type === 'text_delta' && delta.text !== undefined && delta.text !== '') {
					yield { type: CHAT_MODEL_EVENT.textDelta, text: delta.text };
				} else if (delta.type === 'input_json_delta') {
					const open = openBlocks.get(event.index);
					if (open !== undefined) {
						open.inputJson += delta.partial_json ?? '';
					}
				}
				break;
			}
			case 'content_block_stop': {
				const open = openBlocks.get(event.index);
				openBlocks.delete(event.index);
				if (open?.kind === OPEN_BLOCK_KIND.tool) {
					yield {
						type: CHAT_MODEL_EVENT.toolCall,
						id: open.id,
						name: open.name,
						input: parseToolInput(open.inputJson),
					};
				} else if (open?.kind === OPEN_BLOCK_KIND.webSearch) {
					yield {
						type: CHAT_MODEL_EVENT.webSearch,
						query: webSearchQuery(parseToolInput(open.inputJson)),
					};
				}
				break;
			}
			case 'message_delta':
				stopReason = STOP_REASONS[event.delta.stop_reason ?? ''] ?? stopReason;
				break;
			case 'error':
				throw new ChatProviderError(
					`The model stream failed: ${event.error.type}`,
					event.error.type === 'overloaded_error' || event.error.type === 'api_error',
				);
			default:
				break;
		}
	}
	if (stopReason === null) {
		throw new ChatProviderError('The model stream ended without a stop reason', true);
	}
	yield { type: CHAT_MODEL_EVENT.stop, reason: stopReason };
}
