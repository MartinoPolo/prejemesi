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
 * An event the client does not know is skipped, so the server can add kinds first.
 */
export async function streamChatTurn(options: {
	url: string;
	request: ChatTurnRequest;
	signal: AbortSignal;
	onEvent: (event: ChatStreamEvent) => void;
	fetch?: typeof fetch;
}): Promise<ChatTurnRefusal | null> {
	const response = await (options.fetch ?? fetch)(options.url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(options.request),
		signal: options.signal,
	});
	if (!response.ok || response.body === null) {
		return refusalOf(response);
	}
	for await (const data of serverSentEventData(response.body)) {
		const parsed = v.safeParse(ChatStreamEventSchema, parseJson(data));
		if (parsed.success) {
			options.onEvent(parsed.output);
		}
	}
	return null;
}
