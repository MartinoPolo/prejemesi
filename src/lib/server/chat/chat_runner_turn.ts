import {
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	CHAT_TURN_KIND,
	DEFAULT_CHAT_RUNNER_MODEL,
	type ChatRelayEvent,
	type ChatTurnRequest,
} from '$lib/modules/chat/types.js';
import { runAfterResponse } from '$lib/server/background.js';
import {
	CHAT_RUNNER_JOB_STATUS,
	cancelChatRunnerJob,
	createChatRunnerJob,
	isActiveChatRunnerJob,
	readChatRunnerJob,
	settleChatRunnerJob,
	type ChatRunnerJob,
} from './chat_runner_jobs.js';
import { chatRunnerPrompt, chatRunnerSystemPrompt } from './chat_runner_prompt.js';
import { readRecentChatMessages, storeUserMessage, type StoredChatSession } from './chat_store.js';
import { CHAT_LIMITS, CHAT_RUNNER_LIMITS, type ChatRunnerLimits } from './limits.js';
import { waitUnlessAborted } from './wait.js';

export const CHAT_SSE_HEADERS = {
	'content-type': 'text/event-stream; charset=utf-8',
	'cache-control': 'no-store',
	'x-accel-buffering': 'no',
};

export function serverSentEvent(event: ChatRelayEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

/** Where the browser picks a turn's stream up again after one response window. */
function chatRunnerContinuationUrl(sessionId: string, jobId: string, cursor: number) {
	return `/chat/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(jobId)}?cursor=${String(cursor)}`;
}

/** The event that ends a finished job's stream. */
function finalEvent(job: ChatRunnerJob): ChatRelayEvent {
	if (job.status === CHAT_RUNNER_JOB_STATUS.done) {
		return { type: CHAT_STREAM_EVENT.done };
	}
	const error =
		job.status === CHAT_RUNNER_JOB_STATUS.cancelled
			? CHAT_TURN_ERROR.incomplete
			: (job.error ?? CHAT_TURN_ERROR.providerFailed);
	return { type: CHAT_STREAM_EVENT.error, error };
}

/**
 * Streams a runner job's events from `cursor` on. The Worker must not hold one invocation for the
 * whole turn, so the response relays for one window, then names its continuation and closes. A
 * browser that goes away stops the turn; the window ending does not.
 *
 * The relay loop runs within the request's async context, which the database client needs, and
 * `cancel()` runs outside it; so `cancel()` only signals and the loop cancels the job.
 */
export function chatRunnerRelayResponse(options: {
	sessionId: string;
	jobId: string;
	cursor: number;
	limits?: ChatRunnerLimits;
}): Response {
	const limits = options.limits ?? CHAT_RUNNER_LIMITS;
	const browserLeft = new AbortController();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			const emit = (event: ChatRelayEvent) =>
				controller.enqueue(encoder.encode(serverSentEvent(event)));
			const relay = async () => {
				const deadline = Date.now() + limits.relayWindowMs;
				let cursor = options.cursor;
				for (;;) {
					const stored = await readChatRunnerJob(options.sessionId, options.jobId);
					const job = stored === null ? null : await settleChatRunnerJob(stored, limits);
					if (browserLeft.signal.aborted) {
						await cancelChatRunnerJob(options.jobId);
						return;
					}
					if (job === null) {
						emit({ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.incomplete });
						return;
					}
					job.events.slice(cursor).forEach(emit);
					cursor = Math.max(cursor, job.events.length);
					if (!isActiveChatRunnerJob(job)) {
						emit(finalEvent(job));
						return;
					}
					if (Date.now() + limits.relayPollIntervalMs >= deadline) {
						emit({
							type: CHAT_STREAM_EVENT.continue,
							url: chatRunnerContinuationUrl(
								options.sessionId,
								options.jobId,
								cursor,
							),
						});
						return;
					}
					await waitUnlessAborted(limits.relayPollIntervalMs, browserLeft.signal);
				}
			};
			// Kept alive past a browser disconnect, so the loop can still cancel the job.
			runAfterResponse(() =>
				relay()
					.catch((thrown: unknown) => {
						console.error('[chat-runner] relay failed', options.jobId, thrown);
						if (!browserLeft.signal.aborted) {
							emit({
								type: CHAT_STREAM_EVENT.error,
								error: CHAT_TURN_ERROR.incomplete,
							});
						}
					})
					.finally(() => {
						if (!browserLeft.signal.aborted) {
							controller.close();
						}
					}),
			);
		},
		cancel() {
			browserLeft.abort();
		},
	});
	return new Response(body, { headers: CHAT_SSE_HEADERS });
}

/**
 * A turn the chat runner answers: the user's message is stored, the job waits for the runner with
 * the chat as a transcript, and the response relays what the runner reports.
 */
export async function startChatRunnerTurn(turn: {
	session: StoredChatSession;
	user: { name: string };
	request: ChatTurnRequest;
	locale: string;
	limits?: ChatRunnerLimits;
}): Promise<Response> {
	const { session, request } = turn;
	if (request.kind === CHAT_TURN_KIND.message) {
		await storeUserMessage(session, request.text);
	}
	const history = await readRecentChatMessages(session.id, CHAT_LIMITS.contextMessages);
	const job = await createChatRunnerJob({
		sessionId: session.id,
		model: request.model ?? DEFAULT_CHAT_RUNNER_MODEL,
		systemPrompt: chatRunnerSystemPrompt({
			wishlistId: session.wishlistId,
			wishlistShortId: session.wishlistShortId,
			wishlistTitle: session.wishlistTitle,
			userName: turn.user.name,
			locale: turn.locale,
		}),
		prompt: chatRunnerPrompt(history),
	});
	return chatRunnerRelayResponse({
		sessionId: session.id,
		jobId: job.id,
		cursor: 0,
		limits: turn.limits,
	});
}
