import { describe, expect, it } from 'vitest';
import { streamChatTurn } from './chat_turn_stream.js';
import {
	CHAT_AVAILABILITY,
	CHAT_STREAM_EVENT,
	CHAT_TURN_KIND,
	type ChatStreamEvent,
} from './types.js';

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

async function runTurn(response: Response) {
	const events: ChatStreamEvent[] = [];
	const requests: RequestInit[] = [];
	const refusal = await streamChatTurn({
		url: '/chat/session-1/turns',
		request: { kind: CHAT_TURN_KIND.message, text: 'Ahoj' },
		signal: new AbortController().signal,
		onEvent: (event) => events.push(event),
		fetch: (_url, init) => {
			requests.push(init ?? {});
			return Promise.resolve(response);
		},
	});
	return { events, refusal, requests };
}

describe('streamChatTurn', () => {
	it('posts the turn and reads events split across chunks', async () => {
		const body = streamOf([
			'data: {"type":"text","text":"Dob',
			'rý den"}\n\ndata: {"type":"proposal","proposalId":"p1","applied":false}\n\n',
			'data: {"type":"done"}\n\n',
		]);

		const { events, refusal, requests } = await runTurn(new Response(body));

		expect(refusal).toBeNull();
		expect(requests[0]?.body).toBe(JSON.stringify({ kind: 'message', text: 'Ahoj' }));
		expect(events).toEqual([
			{ type: CHAT_STREAM_EVENT.text, text: 'Dobrý den' },
			{ type: CHAT_STREAM_EVENT.proposal, proposalId: 'p1', applied: false },
			{ type: CHAT_STREAM_EVENT.done },
		]);
	});

	it('skips events it does not know', async () => {
		const body = streamOf(['data: {"type":"future"}\n\n', 'data: {"type":"done"}\n\n']);

		const { events } = await runTurn(new Response(body));

		expect(events).toEqual([{ type: CHAT_STREAM_EVENT.done }]);
	});

	it('returns the refusal with its availability before any event', async () => {
		const refused = Response.json(
			{ error: { code: 'FORBIDDEN', availability: CHAT_AVAILABILITY.dailyCapReached } },
			{ status: 403 },
		);

		const { events, refusal } = await runTurn(refused);

		expect(events).toEqual([]);
		expect(refusal).toEqual({
			status: 403,
			code: 'FORBIDDEN',
			availability: CHAT_AVAILABILITY.dailyCapReached,
		});
	});

	it('follows continuations as one turn without handing them on', async () => {
		const events: ChatStreamEvent[] = [];
		const requests: { url: string; init: RequestInit }[] = [];
		const responses = [
			new Response(
				streamOf([
					'data: {"type":"text","text":"Hledám"}\n\n',
					'data: {"type":"continue","url":"/chat/session-1/turns/job-1?cursor=1"}\n\n',
				]),
			),
			new Response(
				streamOf([
					'data: {"type":"tool","name":"web_fetch","query":"https://example.com"}\n\n',
					'data: {"type":"continue","url":"/chat/session-1/turns/job-1?cursor=2"}\n\n',
				]),
			),
			new Response(streamOf(['data: {"type":"done"}\n\n'])),
		];
		const signal = new AbortController().signal;

		const refusal = await streamChatTurn({
			url: '/chat/session-1/turns',
			request: { kind: CHAT_TURN_KIND.message, text: 'Ahoj', model: 'sonnet' },
			signal,
			onEvent: (event) => events.push(event),
			fetch: (url, init) => {
				requests.push({ url: String(url), init: init ?? {} });
				const response = responses.shift();
				return response === undefined
					? Promise.reject(new Error('Unexpected request'))
					: Promise.resolve(response);
			},
		});

		expect(refusal).toBeNull();
		expect(events).toEqual([
			{ type: CHAT_STREAM_EVENT.text, text: 'Hledám' },
			{ type: CHAT_STREAM_EVENT.tool, name: 'web_fetch', query: 'https://example.com' },
			{ type: CHAT_STREAM_EVENT.done },
		]);
		expect(requests.map(({ url, init }) => [url, init.method ?? 'GET'])).toEqual([
			['/chat/session-1/turns', 'POST'],
			['/chat/session-1/turns/job-1?cursor=1', 'GET'],
			['/chat/session-1/turns/job-1?cursor=2', 'GET'],
		]);
		expect(requests.every(({ init }) => init.signal === signal)).toBe(true);
	});

	it('does not follow a continuation outside the app’s chat turns', async () => {
		const requestedUrls: string[] = [];

		const refusal = await streamChatTurn({
			url: '/chat/session-1/turns',
			request: { kind: CHAT_TURN_KIND.message, text: 'Ahoj' },
			signal: new AbortController().signal,
			onEvent: () => {},
			fetch: (url) => {
				requestedUrls.push(String(url));
				return requestedUrls.length > 1
					? Promise.reject(new Error('Followed a foreign continuation'))
					: Promise.resolve(
							new Response(
								streamOf([
									'data: {"type":"continue","url":"https://evil.example/chat/x"}\n\n',
									'data: {"type":"continue","url":"//evil.example/chat/x"}\n\n',
									'data: {"type":"continue","url":"/api/other"}\n\n',
								]),
							),
						);
			},
		});

		expect(refusal).toBeNull();
		expect(requestedUrls).toEqual(['/chat/session-1/turns']);
	});

	it('reports a refusal without a JSON body by its status', async () => {
		const { refusal } = await runTurn(new Response('Bad gateway', { status: 502 }));

		expect(refusal).toEqual({ status: 502, code: null, availability: null });
	});
});
