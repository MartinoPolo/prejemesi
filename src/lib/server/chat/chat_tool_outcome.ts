import {
	CHAT_BROWSE_TOOL,
	CHAT_STREAM_EVENT,
	CHAT_TOOL_STATUS,
	CHAT_TOOL_SUMMARY,
	chatToolOutcome,
	type ChatStreamEvent,
	type ChatToolError,
	type ChatToolOutcome,
	type ChatToolSummary,
	type ChatToolView,
} from '$lib/modules/chat/types.js';
import type { ChatWebToolRecord } from './chat_model.js';
import { chatToolQuery, type ChatToolCall, type ChatToolResultBlock } from './chat_tools.js';
import { CHAT_RUNNER_LIMITS } from './limits.js';

/** Bounds the raw input and result the owner's debug view gets: a result may be a whole page. */
export function truncatedDebugText(text: string): string {
	const maxLength = CHAT_RUNNER_LIMITS.debugTextMaxLength;
	return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function debugInputText(input: unknown): string {
	return truncatedDebugText(JSON.stringify(input ?? null, null, 2));
}

function parsedJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function field(value: unknown, name: string): unknown {
	return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value !== '' ? value : null;
}

/** The `{ error: { code, message } }` every failing app tool result carries. */
function appToolError(body: unknown): ChatToolError | null {
	const error = field(body, 'error');
	if (typeof error !== 'object' || error === null) {
		return null;
	}
	return {
		code: stringOrNull(field(error, 'code')),
		message: stringOrNull(field(error, 'message')),
	};
}

function appToolSummary(name: string, body: unknown): ChatToolSummary | null {
	const markdown = field(body, 'markdown');
	if (name === CHAT_BROWSE_TOOL && typeof markdown === 'string') {
		return {
			kind: CHAT_TOOL_SUMMARY.page,
			characters: markdown.length,
			truncated: field(body, 'truncated') === true,
		};
	}
	const applied = field(body, 'applied');
	if (typeof field(body, 'proposalId') === 'string' && typeof applied === 'boolean') {
		return { kind: CHAT_TOOL_SUMMARY.proposal, applied };
	}
	return null;
}

/** How an app tool call went, by its stored result. */
export function appToolOutcome(
	call: ChatToolCall,
	result: ChatToolResultBlock,
	includeDebug: boolean,
): ChatToolOutcome {
	const body = parsedJson(result.content);
	return {
		status: result.isError ? CHAT_TOOL_STATUS.error : CHAT_TOOL_STATUS.ok,
		error: result.isError ? (appToolError(body) ?? { code: null, message: null }) : null,
		durationMs: result.durationMs ?? null,
		summary: result.isError ? null : appToolSummary(call.name, body),
		...(includeDebug
			? {
					debug: {
						input: debugInputText(call.input),
						result: truncatedDebugText(result.content),
					},
				}
			: {}),
	};
}

/**
 * An app tool call as its tool line shows it; without a stored result its turn stopped before
 * the call finished, so it stays running.
 */
export function appToolView(
	call: ChatToolCall,
	result: ChatToolResultBlock | undefined,
	includeDebug: boolean,
): ChatToolView {
	const identity = { id: call.id, name: call.name, query: chatToolQuery(call) };
	if (result !== undefined) {
		return { ...identity, ...appToolOutcome(call, result, includeDebug) };
	}
	return {
		...identity,
		status: CHAT_TOOL_STATUS.running,
		error: null,
		durationMs: null,
		summary: null,
		...(includeDebug ? { debug: { input: debugInputText(call.input), result: null } } : {}),
	};
}

/** How a web tool the provider or Claude Code ran went. */
export function webToolOutcome(record: ChatWebToolRecord, includeDebug: boolean): ChatToolOutcome {
	return {
		status: record.isError ? CHAT_TOOL_STATUS.error : CHAT_TOOL_STATUS.ok,
		error: record.error,
		durationMs: record.durationMs,
		summary: record.summary,
		...(includeDebug && record.debug !== null ? { debug: record.debug } : {}),
	};
}

/** A web tool the provider or Claude Code ran, as its tool line shows it. */
export function webToolView(record: ChatWebToolRecord, includeDebug: boolean): ChatToolView {
	return {
		id: record.id,
		name: record.name,
		query: record.query,
		...webToolOutcome(record, includeDebug),
	};
}

/** The stream event reporting how the tool call `id` went. */
export function toolResultEvent(id: string, outcome: ChatToolOutcome): ChatStreamEvent {
	return { type: CHAT_STREAM_EVENT.toolResult, id, ...chatToolOutcome(outcome) };
}
