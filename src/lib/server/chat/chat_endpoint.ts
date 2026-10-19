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
import { canRetryChatTurn, runChatTurn } from './chat_agent.js';
import { chatAvailability } from './chat_availability.js';
import { createChatProvider } from './chat_config.js';
import { ChatProviderError, type ChatModelProvider } from './chat_model.js';
import { readRecentChatMessages, requireOwnChatSession } from './chat_store.js';
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

function serverSentEvent(event: ChatStreamEvent): Uint8Array {
	return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * One chat turn, streamed as server-sent events. Every check that can refuse the turn runs first
 * and answers JSON; once streaming starts, failures arrive as an `error` event.
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
	if (availability !== CHAT_AVAILABILITY.available) {
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
		provider = providerFactory();
	} catch (thrown) {
		if (thrown instanceof ChatProviderError) {
			console.error('[chat] provider unavailable', thrown.message);
			return failure(503, SERVER_ERROR.REQUEST_FAILED);
		}
		throw thrown;
	}
	const cancelled = new AbortController();
	const signal = AbortSignal.any([
		cancelled.signal,
		AbortSignal.timeout(CHAT_LIMITS.turnTimeoutMs),
	]);
	const locale = getLocale();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const emit = (streamEvent: ChatStreamEvent) => {
				if (!cancelled.signal.aborted) {
					controller.enqueue(serverSentEvent(streamEvent));
				}
			};
			// Started here, within the request's async context, which the database client needs.
			void runChatTurn({
				session,
				user,
				request,
				locale,
				provider,
				imageBucket: event.platform?.env.R2,
				emit,
				signal,
			}).finally(() => {
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
