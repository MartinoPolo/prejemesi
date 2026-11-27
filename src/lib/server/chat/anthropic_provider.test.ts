import { describe, expect, it } from 'vitest';
import {
	ANTHROPIC_MESSAGES_URL,
	anthropicRequestBody,
	createAnthropicProvider,
} from './anthropic_provider.js';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_ROLE,
	CHAT_STOP_REASON,
	ChatProviderError,
	type ChatModelEvent,
	type ChatModelRequest,
} from './chat_model.js';

/**
 * Contract tests against recorded Messages API streams (shape per the streaming docs: message_start,
 * content blocks with text, input_json and server tool deltas, message_delta, message_stop).
 * The real API is never called; a key is needed only in production.
 */

function sse(events: readonly Record<string, unknown>[]): string {
	return events
		.map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`)
		.join('');
}

const RECORDED_TOOL_TURN = sse([
	{
		type: 'message_start',
		message: { id: 'msg_01', type: 'message', role: 'assistant', content: [], model: 'claude' },
	},
	{ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
	{ type: 'ping' },
	{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hledám ' } },
	{ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'cenu.' } },
	{ type: 'content_block_stop', index: 0 },
	{
		type: 'content_block_start',
		index: 1,
		content_block: {
			type: 'server_tool_use',
			id: 'srvtoolu_01',
			name: 'web_search',
			input: {},
		},
	},
	{
		type: 'content_block_delta',
		index: 1,
		delta: { type: 'input_json_delta', partial_json: '{"query": "Sony WH-1000XM5 cena"}' },
	},
	{ type: 'content_block_stop', index: 1 },
	{
		type: 'content_block_start',
		index: 2,
		content_block: {
			type: 'web_search_tool_result',
			tool_use_id: 'srvtoolu_01',
			content: [
				{ type: 'web_search_result', url: 'https://www.heureka.cz/', title: 'Heureka' },
			],
		},
	},
	{ type: 'content_block_stop', index: 2 },
	{
		type: 'content_block_delta',
		index: 3,
		delta: { type: 'citations_delta', citation: { type: 'web_search_result_location' } },
	},
	{
		type: 'content_block_start',
		index: 4,
		content_block: { type: 'tool_use', id: 'toolu_01', name: 'updateGift', input: {} },
	},
	{
		type: 'content_block_delta',
		index: 4,
		delta: { type: 'input_json_delta', partial_json: '{"id": "gift-1", ' },
	},
	{
		type: 'content_block_delta',
		index: 4,
		delta: { type: 'input_json_delta', partial_json: '"price": 7990}' },
	},
	{ type: 'content_block_stop', index: 4 },
	{
		type: 'message_delta',
		delta: { stop_reason: 'tool_use', stop_sequence: null },
		usage: { output_tokens: 89 },
	},
	{ type: 'message_stop' },
]);

const RECORDED_FETCH_TURN = sse([
	{
		type: 'message_start',
		message: { id: 'msg_02', type: 'message', role: 'assistant', content: [], model: 'claude' },
	},
	{
		type: 'content_block_start',
		index: 0,
		content_block: { type: 'server_tool_use', id: 'srvtoolu_02', name: 'web_fetch', input: {} },
	},
	{
		type: 'content_block_delta',
		index: 0,
		delta: {
			type: 'input_json_delta',
			partial_json: '{"url": "https://www.alza.cz/sony-wh-1000xm5"}',
		},
	},
	{ type: 'content_block_stop', index: 0 },
	{
		type: 'content_block_start',
		index: 1,
		content_block: {
			type: 'web_fetch_tool_result',
			tool_use_id: 'srvtoolu_02',
			content: {
				type: 'web_fetch_result',
				url: 'https://www.alza.cz/sony-wh-1000xm5',
				content: {
					type: 'document',
					source: { type: 'text', media_type: 'text/plain', data: 'Cena 7 990 Kč' },
					title: 'Sony WH-1000XM5',
				},
				retrieved_at: '2026-11-26T10:00:00Z',
			},
		},
	},
	{ type: 'content_block_stop', index: 1 },
	{
		type: 'content_block_start',
		index: 2,
		content_block: {
			type: 'server_tool_use',
			id: 'srvtoolu_03',
			name: 'future_tool',
			input: {},
		},
	},
	{
		type: 'content_block_delta',
		index: 2,
		delta: { type: 'input_json_delta', partial_json: '{"anything": ' },
	},
	{ type: 'content_block_stop', index: 2 },
	{ type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
	{
		type: 'content_block_delta',
		index: 3,
		delta: { type: 'text_delta', text: 'Stojí 7 990 Kč.' },
	},
	{ type: 'content_block_stop', index: 3 },
	{
		type: 'message_delta',
		delta: { stop_reason: 'end_turn', stop_sequence: null },
		usage: { output_tokens: 42 },
	},
	{ type: 'message_stop' },
]);

const request: ChatModelRequest = {
	system: 'Jste asistent.',
	maxOutputTokens: 1024,
	tools: [
		{
			name: 'updateGift',
			description: 'Edits a gift.',
			inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
		},
	],
	messages: [
		{ role: CHAT_ROLE.user, content: [{ type: CHAT_BLOCK.text, text: 'Doplňte cenu.' }] },
		{
			role: CHAT_ROLE.assistant,
			content: [{ type: CHAT_BLOCK.toolCall, id: 'toolu_00', name: 'readGift', input: {} }],
		},
		{
			role: CHAT_ROLE.user,
			content: [
				{
					type: CHAT_BLOCK.toolResult,
					toolCallId: 'toolu_00',
					content: '{}',
					isError: false,
				},
			],
		},
	],
};

/** Splits the recorded stream at awkward points, as a network delivers it. */
function streamedResponse(body: string, chunkSize = 37): Response {
	const bytes = new TextEncoder().encode(body);
	return new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				for (let offset = 0; offset < bytes.length; offset += chunkSize) {
					controller.enqueue(bytes.slice(offset, offset + chunkSize));
				}
				controller.close();
			},
		}),
		{ status: 200, headers: { 'content-type': 'text/event-stream' } },
	);
}

async function collect(events: AsyncIterable<ChatModelEvent>): Promise<ChatModelEvent[]> {
	const collected: ChatModelEvent[] = [];
	for await (const event of events) {
		collected.push(event);
	}
	return collected;
}

describe('Anthropic provider', () => {
	it('sends the conversation as a streamed Messages request with the provider web search and page fetch', async () => {
		const sent: { url: string; init: RequestInit }[] = [];
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async (url, init) => {
				sent.push({ url: String(url), init: init ?? {} });
				return streamedResponse(RECORDED_TOOL_TURN);
			},
		});

		await collect(provider.stream(request, new AbortController().signal));

		expect(sent).toHaveLength(1);
		expect(sent[0]?.url).toBe(ANTHROPIC_MESSAGES_URL);
		expect(sent[0]?.init.headers).toMatchObject({
			'x-api-key': 'test-key',
			'anthropic-version': '2023-06-01',
		});
		expect(JSON.parse(String(sent[0]?.init.body))).toEqual(
			anthropicRequestBody('claude-sonnet-5-5', request),
		);
		expect(anthropicRequestBody('claude-sonnet-5-5', request)).toMatchObject({
			model: 'claude-sonnet-5-5',
			stream: true,
			max_tokens: 1024,
			system: 'Jste asistent.',
			messages: [
				{ role: 'user', content: [{ type: 'text', text: 'Doplňte cenu.' }] },
				{
					role: 'assistant',
					content: [{ type: 'tool_use', id: 'toolu_00', name: 'readGift', input: {} }],
				},
				{
					role: 'user',
					content: [
						{
							type: 'tool_result',
							tool_use_id: 'toolu_00',
							content: '{}',
							is_error: false,
						},
					],
				},
			],
			tools: [
				{ name: 'updateGift', input_schema: { type: 'object' } },
				{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 },
				{
					type: 'web_fetch_20250910',
					name: 'web_fetch',
					max_uses: 5,
					max_content_tokens: 20000,
					url_sources: { client_tool_results: { type: 'none' } },
				},
			],
		});
	});

	it('lets web fetch take addresses from browse_page results only, and from no tool results without it', () => {
		const tool = (name: string) => ({
			name,
			description: name,
			inputSchema: { type: 'object' },
		});
		const webFetchOf = (toolNames: string[]) =>
			anthropicRequestBody('claude-sonnet-5-5', {
				...request,
				tools: toolNames.map(tool),
			}).tools.find((sent) => sent.name === 'web_fetch');

		expect(webFetchOf(['readWishlistGifts', 'createGift', 'browse_page'])).toMatchObject({
			url_sources: {
				client_tool_results: {
					type: 'only',
					tools: [{ type: 'tool_reference', name: 'browse_page' }],
				},
			},
		});
		expect(webFetchOf(['readWishlistGifts', 'createGift'])).toMatchObject({
			url_sources: { client_tool_results: { type: 'none' } },
		});
	});

	it('streams text, the web search and the tool call, then the stop reason', async () => {
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () => streamedResponse(RECORDED_TOOL_TURN),
		});

		expect(await collect(provider.stream(request, new AbortController().signal))).toEqual([
			{ type: CHAT_MODEL_EVENT.textDelta, text: 'Hledám ' },
			{ type: CHAT_MODEL_EVENT.textDelta, text: 'cenu.' },
			{ type: CHAT_MODEL_EVENT.webTool, name: 'web_search', query: 'Sony WH-1000XM5 cena' },
			{ type: CHAT_MODEL_EVENT.webSources, urls: ['https://www.heureka.cz/'] },
			{
				type: CHAT_MODEL_EVENT.toolCall,
				id: 'toolu_01',
				name: 'updateGift',
				input: { id: 'gift-1', price: 7990 },
			},
			{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
		]);
	});

	it('streams a page fetch with its URL, reports the page it read and skips server tools it does not know', async () => {
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () => streamedResponse(RECORDED_FETCH_TURN),
		});

		expect(await collect(provider.stream(request, new AbortController().signal))).toEqual([
			{
				type: CHAT_MODEL_EVENT.webTool,
				name: 'web_fetch',
				query: 'https://www.alza.cz/sony-wh-1000xm5',
			},
			{ type: CHAT_MODEL_EVENT.webSources, urls: ['https://www.alza.cz/sony-wh-1000xm5'] },
			{ type: CHAT_MODEL_EVENT.textDelta, text: 'Stojí 7 990 Kč.' },
			{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
		]);
	});

	it('reports the addresses in the text of a fetched page along with the page', async () => {
		const fetchWithLinks = sse([
			{
				type: 'content_block_start',
				index: 0,
				content_block: {
					type: 'web_fetch_tool_result',
					tool_use_id: 'srvtoolu_06',
					content: {
						type: 'web_fetch_result',
						url: 'https://www.alza.cz/kolo',
						content: {
							type: 'document',
							source: {
								type: 'text',
								media_type: 'text/plain',
								data: 'Kolo ![foto](https://cdn.alza.cz/kolo.jpg). Recenze: https://www.alza.cz/kolo/recenze',
							},
						},
					},
				},
			},
			{ type: 'content_block_stop', index: 0 },
			{ type: 'message_delta', delta: { stop_reason: 'end_turn' } },
		]);
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () => streamedResponse(fetchWithLinks),
		});

		const events = await collect(provider.stream(request, new AbortController().signal));

		expect(events[0]).toMatchObject({ type: CHAT_MODEL_EVENT.webSources });
		const [sources] = events;
		const urls = sources?.type === CHAT_MODEL_EVENT.webSources ? sources.urls : [];
		expect(urls[0]).toBe('https://www.alza.cz/kolo');
		expect(urls).toContain('https://cdn.alza.cz/kolo.jpg');
		expect(urls).toContain('https://www.alza.cz/kolo/recenze');
	});

	it('reports only the page of a fetched PDF, whose encoded text names no address', async () => {
		const fetchedPdf = sse([
			{
				type: 'content_block_start',
				index: 0,
				content_block: {
					type: 'web_fetch_tool_result',
					tool_use_id: 'srvtoolu_07',
					content: {
						type: 'web_fetch_result',
						url: 'https://www.alza.cz/kolo-navod.pdf',
						content: {
							type: 'document',
							source: {
								type: 'base64',
								media_type: 'application/pdf',
								data: btoa('https://attacker.example/x.png'),
							},
						},
					},
				},
			},
			{ type: 'content_block_stop', index: 0 },
			{ type: 'message_delta', delta: { stop_reason: 'end_turn' } },
		]);
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () => streamedResponse(fetchedPdf),
		});

		const events = await collect(provider.stream(request, new AbortController().signal));

		expect(events[0]).toEqual({
			type: CHAT_MODEL_EVENT.webSources,
			urls: ['https://www.alza.cz/kolo-navod.pdf'],
		});
	});

	it('reports no pages for failed web searches and fetches', async () => {
		const failedWebTools = sse([
			{
				type: 'content_block_start',
				index: 0,
				content_block: {
					type: 'web_search_tool_result',
					tool_use_id: 'srvtoolu_04',
					content: { type: 'web_search_tool_result_error', error_code: 'unavailable' },
				},
			},
			{ type: 'content_block_stop', index: 0 },
			{
				type: 'content_block_start',
				index: 1,
				content_block: {
					type: 'web_fetch_tool_result',
					tool_use_id: 'srvtoolu_05',
					content: { type: 'web_fetch_tool_error', error_code: 'url_not_accessible' },
				},
			},
			{ type: 'content_block_stop', index: 1 },
			{ type: 'message_delta', delta: { stop_reason: 'end_turn' } },
		]);
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () => streamedResponse(failedWebTools),
		});

		expect(await collect(provider.stream(request, new AbortController().signal))).toEqual([
			{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
		]);
	});

	it('reports an overloaded API as a retryable failure', async () => {
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () =>
				Response.json(
					{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
					{ status: 529 },
				),
		});

		const failure = await collect(provider.stream(request, new AbortController().signal)).catch(
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(ChatProviderError);
		expect(failure).toMatchObject({ retryable: true });
	});

	it('fails a stream that errors midway or ends without a stop reason', async () => {
		const midwayError = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () =>
				streamedResponse(
					sse([
						{ type: 'message_start', message: {} },
						{
							type: 'error',
							error: { type: 'overloaded_error', message: 'Overloaded' },
						},
					]),
				),
		});
		const cutOff = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () =>
				streamedResponse(
					sse([
						{ type: 'message_start', message: {} },
						{
							type: 'content_block_delta',
							index: 0,
							delta: { type: 'text_delta', text: 'Dob' },
						},
					]),
				),
		});

		for (const provider of [midwayError, cutOff]) {
			await expect(
				collect(provider.stream(request, new AbortController().signal)),
			).rejects.toBeInstanceOf(ChatProviderError);
		}
	});

	it('refuses a bad request without retrying it', async () => {
		const provider = createAnthropicProvider({
			apiKey: 'test-key',
			model: 'claude-sonnet-5-5',
			fetch: async () =>
				Response.json(
					{ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } },
					{ status: 400 },
				),
		});

		await expect(
			collect(provider.stream(request, new AbortController().signal)),
		).rejects.toMatchObject({ retryable: false });
	});
});
