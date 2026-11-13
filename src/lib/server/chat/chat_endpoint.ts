import * as v from 'valibot';
import { getLocale } from '$lib/paraglide/runtime.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CHAT_AVAILABILITY,
	CHAT_TURN_KIND,
	ChatTurnRequestSchema,
} from '$lib/modules/chat/types.js';
import { runAfterResponse } from '$lib/server/background.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { canRetryChatTurn, runChatTurn, type ChatTurn } from './chat_agent.js';
import { chatAvailability, usesChatRunner } from './chat_availability.js';
import { createChatProvider } from './chat_config.js';
import { chatFailure } from './chat_failure.js';
import { ChatProviderError, type ChatModelProvider } from './chat_model.js';
import { readActiveChatRunnerJob, readChatRunnerJob } from './chat_runner_jobs.js';
import {
	CHAT_SSE_HEADERS,
	chatRunnerRelayResponse,
	serverSentEvent,
	startChatRunnerTurn,
} from './chat_runner_turn.js';
import { readRecentChatMessages, requireOwnChatSession } from './chat_store.js';
import { createFakeProvider } from './fake_provider.js';
import { CHAT_LIMITS, CHAT_RUNNER_LIMITS, type ChatRunnerLimits } from './limits.js';

/** What the turn endpoint reads from its SvelteKit request event. */
export interface ChatTurnEvent {
	request: Request;
	params: { sessionId?: string };
	locals: { user?: { id: string; name: string; email: string } };
	platform?: { env: { R2?: AgentImageBucket } };
}

/** What a chat runner turn's continuation reads from its request event. */
export interface ChatTurnContinuationEvent {
	url: URL;
	params: { sessionId?: string; jobId?: string };
	locals: { user?: { id: string } };
}

async function readTurnRequest(request: Request) {
	try {
		return v.safeParse(ChatTurnRequestSchema, await request.json());
	} catch {
		return null;
	}
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
	return new Response(events.join(''), { headers: CHAT_SSE_HEADERS });
}

/**
 * One chat turn, streamed as server-sent events. Every check that can refuse the turn runs first
 * and answers JSON; once streaming starts, failures arrive as an `error` event. Demo turns always
 * use the scripted assistant, never the model API or the chat runner.
 */
export async function handleChatTurnRequest(
	event: ChatTurnEvent,
	providerFactory: () => ChatModelProvider = createChatProvider,
	runnerLimits: ChatRunnerLimits = CHAT_RUNNER_LIMITS,
): Promise<Response> {
	const { user } = event.locals;
	if (user === undefined) {
		return chatFailure(401, SERVER_ERROR.UNAUTHORIZED);
	}
	const parsed = await readTurnRequest(event.request);
	if (parsed === null || !parsed.success) {
		return chatFailure(400, SERVER_ERROR.BAD_REQUEST);
	}
	const session = await requireOwnChatSession(user.id, event.params.sessionId ?? '');
	const availability = await chatAvailability(user);
	const inDemo = availability === CHAT_AVAILABILITY.demo;
	if (!inDemo && availability !== CHAT_AVAILABILITY.available) {
		return chatFailure(403, SERVER_ERROR.FORBIDDEN, { details: { availability } });
	}
	const request = parsed.output;
	if (
		request.kind === CHAT_TURN_KIND.retry &&
		!canRetryChatTurn(await readRecentChatMessages(session.id, CHAT_LIMITS.contextMessages))
	) {
		return chatFailure(409, SERVER_ERROR.CONFLICT);
	}
	if (usesChatRunner(user.email)) {
		if ((await readActiveChatRunnerJob(session.id, runnerLimits)) !== null) {
			return chatFailure(409, SERVER_ERROR.CONFLICT);
		}
		return startChatRunnerTurn({
			session,
			user,
			request,
			locale: getLocale(),
			limits: runnerLimits,
		});
	}
	let provider: ChatModelProvider;
	try {
		provider = inDemo ? createFakeProvider() : providerFactory();
	} catch (thrown) {
		if (thrown instanceof ChatProviderError) {
			console.error('[chat] provider unavailable', thrown.message);
			return chatFailure(503, SERVER_ERROR.REQUEST_FAILED);
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
			const emit: ChatTurn['emit'] = (streamEvent) => {
				if (!cancelled.signal.aborted) {
					controller.enqueue(new TextEncoder().encode(serverSentEvent(streamEvent)));
				}
			};
			// Started here, within the request's async context, which the database client needs,
			// and kept alive past a browser that goes away, so the turn stores what it streamed.
			// Leaving aborts a model turn as Stop does: the two arrive alike, and `waitUntil`
			// outlives a disconnect by 30 seconds, less than a turn may take.
			runAfterResponse(() =>
				runChatTurn({ ...turn, emit, signal }).finally(() => {
					if (!cancelled.signal.aborted) {
						controller.close();
					}
				}),
			);
		},
		cancel() {
			cancelled.abort();
		},
	});
	return new Response(body, { headers: CHAT_SSE_HEADERS });
}

/** A chat runner turn's stream after a `continue` event, for the chat's own user only. */
export async function handleChatTurnContinuation(
	event: ChatTurnContinuationEvent,
	runnerLimits: ChatRunnerLimits = CHAT_RUNNER_LIMITS,
): Promise<Response> {
	const { user } = event.locals;
	if (user === undefined) {
		return chatFailure(401, SERVER_ERROR.UNAUTHORIZED);
	}
	const session = await requireOwnChatSession(user.id, event.params.sessionId ?? '');
	const job = await readChatRunnerJob(session.id, event.params.jobId ?? '');
	if (job === null) {
		return chatFailure(404, SERVER_ERROR.NOT_FOUND);
	}
	const cursor = Number.parseInt(event.url.searchParams.get('cursor') ?? '0', 10);
	return chatRunnerRelayResponse({
		sessionId: session.id,
		jobId: job.id,
		cursor: Number.isSafeInteger(cursor) && cursor > 0 ? cursor : 0,
		limits: runnerLimits,
	});
}
