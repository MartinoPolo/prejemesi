import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { getLocale } from '$lib/paraglide/runtime.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CHAT_AVAILABILITY,
	CHAT_TURN_KIND,
	ChatTurnRequestSchema,
	type ChatStreamEvent,
} from '$lib/modules/chat/types.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { canRetryChatTurn, runChatTurn, type ChatTurn } from './chat_agent.js';
import { chatAvailability } from './chat_availability.js';
import { createChatProvider } from './chat_config.js';
import { ChatProviderError, type ChatModelProvider } from './chat_model.js';
import { readRecentChatMessages, requireOwnChatSession } from './chat_store.js';
import { createFakeProvider } from './fake_provider.js';
import { CHAT_LIMITS } from './limits.js';

/** What the turn endpoint reads from its SvelteKit request event. */
export interface ChatTurnEvent {
	request: Request;
	params: { sessionId?: string };
	locals: { user?: { id: string; name: string; email: string } };
	platform?: { env: { R2?: AgentImageBucket } };
}

const SSE_HEADERS = {
	'content-type': 'text/event-stream; charset=utf-8',
	'cache-control': 'no-store',
	'x-accel-buffering': 'no',
};

function failure(status: number, code: string, details: Record<string, unknown> = {}) {
	return json({ error: { code, ...details } }, { status });
}

async function readTurnRequest(request: Request) {
	try {
		return v.safeParse(ChatTurnRequestSchema, await request.json());
	} catch {
		return null;
	}
}

function serverSentEvent(event: ChatStreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * A demo request runs in a database transaction that commits once its response returns, so the
 * whole turn runs first and its events arrive together.
 */
async function demoTurnResponse(turn: Omit<ChatTurn, 'emit' | 'signal'>): Promise<Response> {
	const events: string[] = [];
	await runChatTurn({
		...turn,
		emit: (streamEvent) => events.push(serverSentEvent(streamEvent)),
		signal: AbortSignal.timeout(CHAT_LIMITS.turnTimeoutMs),
	});
	return new Response(events.join(''), { headers: SSE_HEADERS });
}

/**
 * One chat turn, streamed as server-sent events. Every check that can refuse the turn runs first
 * and answers JSON; once streaming starts, failures arrive as an `error` event. Demo turns always
 * use the scripted assistant, never the model API.
 */
export async function handleChatTurnRequest(
	event: ChatTurnEvent,
	providerFactory: () => ChatModelProvider = createChatProvider,
): Promise<Response> {
	const { user } = event.locals;
	if (user === undefined) {
		return failure(401, SERVER_ERROR.UNAUTHORIZED);
	}
	const parsed = await readTurnRequest(event.request);
	if (parsed === null || !parsed.success) {
		return failure(400, SERVER_ERROR.BAD_REQUEST);
	}
	const session = await requireOwnChatSession(user.id, event.params.sessionId ?? '');
	const availability = await chatAvailability(user);
	const inDemo = availability === CHAT_AVAILABILITY.demo;
	if (!inDemo && availability !== CHAT_AVAILABILITY.available) {
		return failure(403, SERVER_ERROR.FORBIDDEN, { availability });
	}
	const request = parsed.output;
	if (
		request.kind === CHAT_TURN_KIND.retry &&
		!canRetryChatTurn(await readRecentChatMessages(session.id, CHAT_LIMITS.contextMessages))
	) {
		return failure(409, SERVER_ERROR.CONFLICT);
	}
	let provider: ChatModelProvider;
	try {
		provider = inDemo ? createFakeProvider() : providerFactory();
	} catch (thrown) {
		if (thrown instanceof ChatProviderError) {
			console.error('[chat] provider unavailable', thrown.message);
			return failure(503, SERVER_ERROR.REQUEST_FAILED);
		}
		throw thrown;
	}
	const turn = {
		session,
		user,
		request,
		locale: getLocale(),
		provider,
		imageBucket: event.platform?.env.R2,
	};
	if (inDemo) {
		return demoTurnResponse(turn);
	}
	const cancelled = new AbortController();
	const signal = AbortSignal.any([
		cancelled.signal,
		AbortSignal.timeout(CHAT_LIMITS.turnTimeoutMs),
	]);
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const emit = (streamEvent: ChatStreamEvent) => {
				if (!cancelled.signal.aborted) {
					controller.enqueue(new TextEncoder().encode(serverSentEvent(streamEvent)));
				}
			};
			// Started here, within the request's async context, which the database client needs.
			void runChatTurn({ ...turn, emit, signal }).finally(() => {
				if (!cancelled.signal.aborted) {
					controller.close();
				}
			});
		},
		cancel() {
			cancelled.abort();
		},
	});
	return new Response(body, { headers: SSE_HEADERS });
}
