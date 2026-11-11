import * as v from 'valibot';
import { serverSentEventData } from './server_sent_events.js';
import {
	CHAT_AVAILABILITY,
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	type ChatAvailability,
	type ChatStreamEvent,
	type ChatTurnRequest,
} from './types.js';

const ChatStreamEventSchema = v.variant('type', [
	v.object({ type: v.literal(CHAT_STREAM_EVENT.text), text: v.string() }),
	v.object({
		type: v.literal(CHAT_STREAM_EVENT.tool),
		name: v.string(),
		query: v.nullable(v.string()),
	}),
	v.object({
		type: v.literal(CHAT_STREAM_EVENT.proposal),
		proposalId: v.string(),
		applied: v.boolean(),
	}),
	v.object({ type: v.literal(CHAT_STREAM_EVENT.error), error: v.enum(CHAT_TURN_ERROR) }),
	v.object({ type: v.literal(CHAT_STREAM_EVENT.done) }),
	// Only the app's own turn streams are followed.
	v.object({
		type: v.literal(CHAT_STREAM_EVENT.continue),
		url: v.pipe(v.string(), v.startsWith('/chat/')),
	}),
]);

const TurnRefusalSchema = v.object({
	error: v.object({
		code: v.string(),
		availability: v.optional(v.enum(CHAT_AVAILABILITY)),
	}),
});

/** Why the endpoint refused the turn before streaming; nothing was stored. */
export interface ChatTurnRefusal {
	status: number;
	code: string | null;
	availability: ChatAvailability | null;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

async function refusalOf(response: Response): Promise<ChatTurnRefusal> {
	const parsed = v.safeParse(TurnRefusalSchema, parseJson(await response.text()));
	return {
		status: response.status,
		code: parsed.success ? parsed.output.error.code : null,
		availability: parsed.success ? (parsed.output.error.availability ?? null) : null,
	};
}

/**
 * Posts one turn and hands each streamed event to `onEvent`; a refusal answers before streaming.
 * An event the client does not know is skipped, so the server can add kinds first. A turn that
 * continues at another URL is followed there, so the caller sees one stream.
 */
export async function streamChatTurn(options: {
	url: string;
	request: ChatTurnRequest;
	signal: AbortSignal;
	onEvent: (event: ChatStreamEvent) => void;
	fetch?: typeof fetch;
}): Promise<ChatTurnRefusal | null> {
	const fetchTurn = options.fetch ?? fetch;
	const response = await fetchTurn(options.url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(options.request),
		signal: options.signal,
	});
	if (!response.ok || response.body === null) {
		return refusalOf(response);
	}
	let continuationUrl = await readTurnEvents(response.body, options.onEvent);
	while (continuationUrl !== null) {
		const continued = await fetchTurn(continuationUrl, { signal: options.signal });
		if (!continued.ok || continued.body === null) {
			throw new Error(`The turn's continuation answered ${String(continued.status)}`);
		}
		continuationUrl = await readTurnEvents(continued.body, options.onEvent);
	}
	return null;
}

/** Hands one response's events on; answers where the turn continues, if it does. */
async function readTurnEvents(
	body: ReadableStream<Uint8Array>,
	onEvent: (event: ChatStreamEvent) => void,
): Promise<string | null> {
	let continuationUrl: string | null = null;
	for await (const data of serverSentEventData(body)) {
		const parsed = v.safeParse(ChatStreamEventSchema, parseJson(data));
		if (!parsed.success) {
			continue;
		}
		if (parsed.output.type === CHAT_STREAM_EVENT.continue) {
			continuationUrl = parsed.output.url;
		} else {
			onEvent(parsed.output);
		}
	}
	return continuationUrl;
}
