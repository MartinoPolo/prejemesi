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

	it('reports a refusal without a JSON body by its status', async () => {
		const { refusal } = await runTurn(new Response('Bad gateway', { status: 502 }));

		expect(refusal).toEqual({ status: 502, code: null, availability: null });
	});
});
