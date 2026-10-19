import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import {
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	CHAT_TURN_KIND,
	type ChatStreamEvent,
	type ChatTurnError,
	type ChatTurnRequest,
} from '$lib/modules/chat/types.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from '$lib/server/agent_access/agent_caller.js';
import { scheduleAgentAccessPurge } from '$lib/server/agent_access/agent_access_purge.js';
import { OPERATION_CHANNEL } from '$lib/server/operations/actor.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_ROLE,
	CHAT_STOP_REASON,
	ChatProviderError,
	type ChatContentBlock,
	type ChatModelMessage,
	type ChatModelProvider,
	type ChatStopReason,
} from './chat_model.js';
import { chatSystemPrompt } from './chat_prompt.js';
import {
	readRecentChatMessages,
	storeAssistantMessage,
	storeUserMessage,
	type StoredChatMessage,
	type StoredChatSession,
} from './chat_store.js';
import { chatTools, runChatToolCalls, type ChatToolCall } from './chat_tools.js';
import { CHAT_LIMITS } from './limits.js';

/** Recorded on the chat's proposals; the UI labels them by the chatbot channel. */
export const CHAT_GRANT_NAME = 'AI asistent';

/** Every scope but reserver names: the model provider is a third party (DECISIONS 2026-10-10). */
const CHAT_SCOPES = Object.values(AGENT_SCOPE).filter(
	(scope) => scope !== AGENT_SCOPE.reservationsIdentities,
);

/** The chat acts as its user, limited to its wishlist, with fast-forward as the chat sets it. */
function chatCaller(
	session: Pick<StoredChatSession, 'id' | 'wishlistId' | 'fastForward'>,
	user: { id: string; name: string },
): AgentCaller {
	return {
		credential: { kind: AGENT_CREDENTIAL_KIND.chatSession, id: session.id },
		fastForward: session.fastForward,
		grant: {
			userId: user.id,
			userName: user.name,
			tokenName: CHAT_GRANT_NAME,
			channel: OPERATION_CHANNEL.chatbot,
			scopes: CHAT_SCOPES,
			wishlistIds: [session.wishlistId],
		},
	};
}

/** Stored messages as the model reads them: tool results follow their calls as the user's turn. */
function chatModelMessages(messages: readonly StoredChatMessage[]): ChatModelMessage[] {
	return messages.flatMap((message): ChatModelMessage[] => {
		if (message.role === CHAT_ROLE.user) {
			return [{ role: CHAT_ROLE.user, content: message.content }];
		}
		const response = message.content.filter((block) => block.type !== CHAT_BLOCK.toolResult);
		const results = message.content.filter((block) => block.type === CHAT_BLOCK.toolResult);
		return [
			{ role: CHAT_ROLE.assistant, content: response },
			...(results.length === 0 ? [] : [{ role: CHAT_ROLE.user, content: results }]),
		];
	});
}

/** A failed turn can be retried: the chat ends with the user's message or with tool results. */
export function canRetryChatTurn(messages: readonly StoredChatMessage[]): boolean {
	const last = messages.at(-1);
	return (
		last !== undefined &&
		(last.role === CHAT_ROLE.user ||
			last.content.some((block) => block.type === CHAT_BLOCK.toolResult))
	);
}

export interface ChatTurn {
	session: StoredChatSession;
	user: { id: string; name: string };
	request: ChatTurnRequest;
	locale: string;
	provider: ChatModelProvider;
	imageBucket: AgentImageBucket | undefined;
	emit: (event: ChatStreamEvent) => void;
	signal: AbortSignal;
}

interface ModelResponse {
	content: ChatContentBlock[];
	calls: ChatToolCall[];
	stopReason: ChatStopReason;
}

async function streamModelResponse(
	turn: ChatTurn,
	system: string,
	tools: ReturnType<typeof chatTools>,
): Promise<ModelResponse> {
	const history = await readRecentChatMessages(turn.session.id, CHAT_LIMITS.contextMessages);
	let text = '';
	const calls: ChatToolCall[] = [];
	let stopReason: ChatStopReason | null = null;
	const events = turn.provider.stream(
		{
			system,
			messages: chatModelMessages(history),
			tools,
			maxOutputTokens: CHAT_LIMITS.maxOutputTokens,
		},
		turn.signal,
	);
	for await (const event of events) {
		switch (event.type) {
			case CHAT_MODEL_EVENT.textDelta:
				text += event.text;
				turn.emit({ type: CHAT_STREAM_EVENT.text, text: event.text });
				break;
			case CHAT_MODEL_EVENT.webSearch:
				turn.emit({ type: CHAT_STREAM_EVENT.tool, name: 'web_search', query: event.query });
				break;
			case CHAT_MODEL_EVENT.toolCall:
				calls.push({ id: event.id, name: event.name, input: event.input });
				turn.emit({ type: CHAT_STREAM_EVENT.tool, name: event.name, query: null });
				break;
			case CHAT_MODEL_EVENT.stop:
				stopReason = event.reason;
				break;
		}
	}
	if (stopReason === null) {
		throw new ChatProviderError('The model response ended without a stop reason', true);
	}
	const content: ChatContentBlock[] = text === '' ? [] : [{ type: CHAT_BLOCK.text, text }];
	for (const call of calls) {
		content.push({ type: CHAT_BLOCK.toolCall, ...call });
	}
	return { content, calls, stopReason };
}

/**
 * One turn: the user's message (or a retry after a failed answer), then model responses until the
 * model answers without tools, each response stored with its tool results. A failure stops the
 * turn and leaves what was stored, so a retry resumes from there.
 */
export async function runChatTurn(turn: ChatTurn): Promise<void> {
	const { session } = turn;
	const caller = chatCaller(session, turn.user);
	const tools = chatTools(caller);
	const system = chatSystemPrompt({
		wishlistId: session.wishlistId,
		wishlistShortId: session.wishlistShortId,
		wishlistTitle: session.wishlistTitle,
		userName: turn.user.name,
		locale: turn.locale,
	});
	try {
		if (turn.request.kind === CHAT_TURN_KIND.message) {
			await storeUserMessage(session, turn.request.text);
		}
		for (let call = 0; call < CHAT_LIMITS.modelCallsPerTurn; call += 1) {
			const response = await streamModelResponse(turn, system, tools);
			if (response.stopReason !== CHAT_STOP_REASON.toolUse || response.calls.length === 0) {
				if (response.content.length > 0) {
					await storeAssistantMessage(session.id, response.content, null);
				}
				turn.emit({ type: CHAT_STREAM_EVENT.done });
				return;
			}
			const round = await runChatToolCalls(
				caller,
				tools,
				session.wishlistId,
				response.calls,
				turn.imageBucket,
			);
			await storeAssistantMessage(
				session.id,
				[...response.content, ...round.results],
				round.proposal?.id ?? null,
			);
			if (round.proposal !== null) {
				turn.emit({
					type: CHAT_STREAM_EVENT.proposal,
					proposalId: round.proposal.id,
					applied: round.proposal.applied,
				});
			}
		}
		emitTurnError(turn, CHAT_TURN_ERROR.incomplete);
	} catch (thrown) {
		if (turn.signal.aborted) {
			emitTurnError(turn, CHAT_TURN_ERROR.incomplete);
		} else {
			console.error('[chat] turn failed', session.id, thrown);
			emitTurnError(turn, CHAT_TURN_ERROR.providerFailed);
		}
	} finally {
		scheduleAgentAccessPurge();
	}
}

function emitTurnError(turn: ChatTurn, error: ChatTurnError) {
	turn.emit({ type: CHAT_STREAM_EVENT.error, error });
}
