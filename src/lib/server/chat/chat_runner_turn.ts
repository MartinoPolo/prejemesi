import {
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	CHAT_TURN_KIND,
	DEFAULT_CHAT_RUNNER_EFFORT,
	DEFAULT_CHAT_RUNNER_MODEL,
	type ChatRelayEvent,
	type ChatStreamEvent,
	type ChatTurnRequest,
} from '$lib/modules/chat/types.js';
import { isHttpError } from '@sveltejs/kit';
import type { AgentCaller } from '$lib/server/agent_access/agent_caller.js';
import { AgentApiFailure } from '$lib/server/agent_access/api.js';
import { readChangeProposalForAgent } from '$lib/server/agent_access/change_proposal_api.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { chatFailure } from './chat_failure.js';
import {
	CHAT_RUNNER_JOB_STATUS,
	createChatRunnerJob,
	isActiveChatRunnerJob,
	readActiveChatRunnerJob,
	readChatRunnerJob,
	settleChatRunnerJob,
	type ChatRunnerJob,
} from './chat_runner_jobs.js';
import {
	chatRunnerPrompt,
	chatRunnerSystemPrompt,
	type ChatProposalOutcome,
} from './chat_runner_prompt.js';
import {
	readRecentChatMessages,
	storeUserMessage,
	type StoredChatMessage,
	type StoredChatSession,
} from './chat_store.js';
import { chatCaller } from './chat_agent.js';
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

/**
 * Where a panel opened after its turn started rejoins the stream of the chat's unfinished runner
 * turn, if it has one. The stored chat already shows the text reported so far, so the stream
 * starts after it; read the chat's messages first.
 */
export async function activeChatTurnUrl(
	sessionId: string,
	limits: ChatRunnerLimits = CHAT_RUNNER_LIMITS,
): Promise<string | null> {
	const job = await readActiveChatRunnerJob(sessionId, limits);
	return job === null ? null : chatRunnerContinuationUrl(sessionId, job.id, job.events.length);
}

/**
 * The runner reports each text block of Claude Code's answer whole, so text after text is a
 * further step and starts a new paragraph, as the stored chat shows it.
 */
function relayedEvent(event: ChatStreamEvent, previous: ChatStreamEvent | undefined) {
	return event.type === CHAT_STREAM_EVENT.text && previous?.type === CHAT_STREAM_EVENT.text
		? { ...event, text: `\n\n${event.text}` }
		: event;
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
 * browser that goes away only ends the relay: the job runs on for the panel to rejoin, and only
 * the user's Stop or the job's own limits end it.
 *
 * The relay loop runs within the request's async context, which the database client needs.
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
						return;
					}
					if (job === null) {
						emit({ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.incomplete });
						return;
					}
					job.events
						.slice(cursor)
						.forEach((event, offset) =>
							emit(relayedEvent(event, job.events[cursor + offset - 1])),
						);
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
			void relay()
				.catch((thrown: unknown) => {
					console.error('[chat-runner] relay failed', options.jobId, thrown);
					if (!browserLeft.signal.aborted) {
						emit({ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.incomplete });
					}
				})
				.finally(() => {
					if (!browserLeft.signal.aborted) {
						controller.close();
					}
				});
		},
		cancel() {
			browserLeft.abort();
		},
	});
	return new Response(body, { headers: CHAT_SSE_HEADERS });
}

/**
 * What became of each proposal the messages made, as the chat's own agent reads it now. A
 * proposal the chat can no longer read, such as one on a deleted wishlist, is left out.
 */
async function readProposalOutcomes(
	caller: AgentCaller,
	messages: readonly StoredChatMessage[],
): Promise<Map<string, ChatProposalOutcome>> {
	const proposalIds = new Set(
		messages.flatMap((message) => (message.proposalId === null ? [] : [message.proposalId])),
	);
	const outcomes = new Map<string, ChatProposalOutcome>();
	await Promise.all(
		[...proposalIds].map(async (proposalId) => {
			try {
				outcomes.set(proposalId, await readChangeProposalForAgent(caller, proposalId));
			} catch (thrown) {
				if (!isHttpError(thrown) && !(thrown instanceof AgentApiFailure)) {
					throw thrown;
				}
			}
		}),
	);
	return outcomes;
}

/**
 * A turn the chat runner answers: the user's message is stored, the job waits for the runner with
 * the chat as a transcript, and the response relays what the runner reports. A turn its Stop
 * overtook is refused and leaves the message unanswered, as a turn stopped later does.
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
	const proposalOutcomes = await readProposalOutcomes(
		chatCaller(session, { id: session.userId, name: turn.user.name }),
		history,
	);
	const job = await createChatRunnerJob({
		id: request.turnId,
		sessionId: session.id,
		model: request.model ?? DEFAULT_CHAT_RUNNER_MODEL,
		effort: request.effort ?? DEFAULT_CHAT_RUNNER_EFFORT,
		systemPrompt: chatRunnerSystemPrompt({
			wishlistId: session.wishlistId,
			wishlistShortId: session.wishlistShortId,
			wishlistTitle: session.wishlistTitle,
			userName: turn.user.name,
			locale: turn.locale,
		}),
		prompt: chatRunnerPrompt(history, proposalOutcomes),
	});
	if (job === null) {
		return chatFailure(409, SERVER_ERROR.CONFLICT);
	}
	return chatRunnerRelayResponse({
		sessionId: session.id,
		jobId: job.id,
		cursor: 0,
		limits: turn.limits,
	});
}
