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
	isChatModelContentBlock,
	type ChatContentBlock,
	type ChatModelMessage,
	type ChatModelProvider,
	type ChatStopReason,
	type ChatWebToolRecord,
} from './chat_model.js';
import { conversationUrls } from './browse_page.js';
import { browsePageConfig } from './chat_config.js';
import { chatSystemPrompt } from './chat_prompt.js';
import {
	readRecentChatMessages,
	storeAssistantMessage,
	storeUserMessage,
	type StoredChatMessage,
	type StoredChatSession,
} from './chat_store.js';
import { appToolOutcome, toolResultEvent, webToolOutcome } from './chat_tool_outcome.js';
import {
	chatToolQuery,
	chatTools,
	runChatToolCalls,
	type ChatToolCall,
	type ChatToolRound,
} from './chat_tools.js';
import { CHAT_LIMITS } from './limits.js';

/** Recorded on the chat's proposals; the UI labels them by the chatbot channel. */
export const CHAT_GRANT_NAME = 'AI asistent';

/** Every scope but reserver names: the model provider is a third party (DECISIONS 2026-10-10). */
const CHAT_SCOPES = Object.values(AGENT_SCOPE).filter(
	(scope) => scope !== AGENT_SCOPE.reservationsIdentities,
);

/** The chat acts as its user, limited to its wishlist, with fast-forward as the chat sets it. */
export function chatCaller(
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

/**
 * Stored messages as the model reads them: tool results follow their calls as the user's turn,
 * and records of web tools the provider ran itself are left out, so a message of only those is.
 */
function chatModelMessages(messages: readonly StoredChatMessage[]): ChatModelMessage[] {
	return messages.flatMap((message): ChatModelMessage[] => {
		const content = message.content.filter(isChatModelContentBlock);
		if (content.length === 0) {
			return [];
		}
		if (message.role === CHAT_ROLE.user) {
			return [{ role: CHAT_ROLE.user, content }];
		}
		const response = content.filter((block) => block.type !== CHAT_BLOCK.toolResult);
		const results = content.filter((block) => block.type === CHAT_BLOCK.toolResult);
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
	/** The addresses its `browse_page` and `uploadImage` calls may use: see `conversationUrls`. */
	conversationUrls: ReadonlySet<string>;
}

/** The text of the response being streamed, which the user already reads before it is stored. */
interface StreamedText {
	text: string;
}

/**
 * Streams one model response. `webSourceUrls` collects the pages the provider's web tools found
 * and the addresses in fetched pages' text across the turn's responses, as their results are not
 * kept in the history.
 */
async function streamModelResponse(
	turn: ChatTurn,
	system: string,
	tools: ReturnType<typeof chatTools>,
	streamed: StreamedText,
	webSourceUrls: Set<string>,
): Promise<ModelResponse> {
	const history = await readRecentChatMessages(turn.session.id, CHAT_LIMITS.contextMessages);
	const messages = chatModelMessages(history);
	const calls: ChatToolCall[] = [];
	const webTools: ChatWebToolRecord[] = [];
	const startedWebTools = new Map<
		string,
		Pick<ChatWebToolRecord, 'name' | 'query'> & { debugInput: string; startedAt: number }
	>();
	let stopReason: ChatStopReason | null = null;
	const events = turn.provider.stream(
		{
			system,
			messages,
			tools,
			maxOutputTokens: CHAT_LIMITS.maxOutputTokens,
		},
		turn.signal,
	);
	for await (const event of events) {
		switch (event.type) {
			case CHAT_MODEL_EVENT.textDelta:
				streamed.text += event.text;
				turn.emit({ type: CHAT_STREAM_EVENT.text, text: event.text });
				break;
			case CHAT_MODEL_EVENT.webTool:
				startedWebTools.set(event.id, {
					name: event.name,
					query: event.query,
					debugInput: event.debugInput,
					startedAt: Date.now(),
				});
				turn.emit({
					type: CHAT_STREAM_EVENT.tool,
					id: event.id,
					name: event.name,
					query: event.query,
				});
				break;
			case CHAT_MODEL_EVENT.webToolResult: {
				const started = startedWebTools.get(event.id);
				if (started === undefined) {
					break;
				}
				const record: ChatWebToolRecord = {
					type: CHAT_BLOCK.webTool,
					id: event.id,
					name: started.name,
					query: started.query,
					isError: event.error !== null,
					error: event.error,
					summary: event.summary,
					durationMs: Date.now() - started.startedAt,
					debug: { input: started.debugInput, result: event.debugResult },
				};
				webTools.push(record);
				turn.emit(toolResultEvent(record.id, webToolOutcome(record, false)));
				break;
			}
			case CHAT_MODEL_EVENT.webSources:
				for (const url of event.urls) {
					webSourceUrls.add(url);
				}
				break;
			case CHAT_MODEL_EVENT.toolCall:
				calls.push({ id: event.id, name: event.name, input: event.input });
				turn.emit({
					type: CHAT_STREAM_EVENT.tool,
					id: event.id,
					name: event.name,
					query: chatToolQuery(event),
				});
				break;
			case CHAT_MODEL_EVENT.stop:
				stopReason = event.reason;
				break;
		}
	}
	if (stopReason === null) {
		throw new ChatProviderError('The model response ended without a stop reason', true);
	}
	const { text } = streamed;
	const content: ChatContentBlock[] = text === '' ? [] : [{ type: CHAT_BLOCK.text, text }];
	content.push(...webTools);
	for (const call of calls) {
		content.push({ type: CHAT_BLOCK.toolCall, ...call });
	}
	return {
		content,
		calls,
		stopReason,
		conversationUrls: conversationUrls(messages, webSourceUrls),
	};
}

/**
 * One turn: the user's message (or a retry after a failed answer), then model responses until the
 * model answers without tools, each response stored with its tool results. A failure stops the
 * turn and leaves what was stored, so a retry resumes from there. A turn cut short by Stop, a
 * browser that went away or the time limit also keeps the text it already streamed.
 */
export async function runChatTurn(turn: ChatTurn): Promise<void> {
	const { session } = turn;
	const caller = chatCaller(session, turn.user);
	const pageBrowser = browsePageConfig();
	const tools = chatTools(caller, pageBrowser);
	const system = chatSystemPrompt(
		{
			wishlistId: session.wishlistId,
			wishlistShortId: session.wishlistShortId,
			wishlistTitle: session.wishlistTitle,
			userName: turn.user.name,
			locale: turn.locale,
		},
		{ canBrowsePages: pageBrowser !== null, requiresConversationAddresses: true },
	);
	const streamed: StreamedText = { text: '' };
	const webSourceUrls = new Set<string>();
	try {
		if (turn.request.kind === CHAT_TURN_KIND.message) {
			await storeUserMessage(session, turn.request.text);
		}
		for (let call = 0; call < CHAT_LIMITS.modelCallsPerTurn; call += 1) {
			streamed.text = '';
			const response = await streamModelResponse(
				turn,
				system,
				tools,
				streamed,
				webSourceUrls,
			);
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
				{
					imageBucket: turn.imageBucket,
					signal: turn.signal,
					conversationUrls: response.conversationUrls,
				},
			);
			await storeAssistantMessage(
				session.id,
				[...response.content, ...round.results],
				round.proposal?.id ?? null,
			);
			streamed.text = '';
			emitToolRound(turn, response.calls, round);
		}
		emitTurnError(turn, CHAT_TURN_ERROR.incomplete);
	} catch (thrown) {
		if (turn.signal.aborted) {
			await keepStreamedText(session.id, streamed.text);
			emitTurnError(turn, CHAT_TURN_ERROR.incomplete);
		} else {
			console.error('[chat] turn failed', session.id, thrown);
			emitTurnError(turn, CHAT_TURN_ERROR.providerFailed);
		}
	} finally {
		scheduleAgentAccessPurge();
	}
}

/** Each call's outcome, then the proposal the round's changes made, if any. */
function emitToolRound(turn: ChatTurn, calls: readonly ChatToolCall[], round: ChatToolRound) {
	for (const call of calls) {
		const result = round.results.find((block) => block.toolCallId === call.id);
		if (result !== undefined) {
			turn.emit(toolResultEvent(call.id, appToolOutcome(call, result, false)));
		}
	}
	if (round.proposal !== null) {
		turn.emit({
			type: CHAT_STREAM_EVENT.proposal,
			proposalId: round.proposal.id,
			applied: round.proposal.applied,
		});
	}
}

/** Stored as the assistant's message, so a reload still shows what the user read. */
async function keepStreamedText(sessionId: string, text: string): Promise<void> {
	if (text.trim() === '') {
		return;
	}
	try {
		await storeAssistantMessage(sessionId, [{ type: CHAT_BLOCK.text, text }], null);
	} catch (thrown) {
		console.error('[chat] keeping the streamed text failed', sessionId, thrown);
	}
}

function emitTurnError(turn: ChatTurn, error: ChatTurnError) {
	turn.emit({ type: CHAT_STREAM_EVENT.error, error });
}
