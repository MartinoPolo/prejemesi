import * as v from 'valibot';

/** Whether the AI assistant answers this user now, and why not. */
export const CHAT_AVAILABILITY = {
	available: 'available',
	/** Not on the family allowlist: the client shows no entry point at all. */
	notAllowed: 'notAllowed',
	/** The kill switch or the global daily cap; history stays readable. */
	disabled: 'disabled',
	/** The user's daily cap; it resets at midnight Prague time. */
	dailyCapReached: 'dailyCapReached',
	/** The demo playground answers predefined actions only. */
	demo: 'demo',
} as const;

export type ChatAvailability = (typeof CHAT_AVAILABILITY)[keyof typeof CHAT_AVAILABILITY];

const CHAT_MESSAGE_MAX_LENGTH = 4000;

export const CHAT_ROLE = {
	user: 'user',
	assistant: 'assistant',
} as const;

export type ChatRole = (typeof CHAT_ROLE)[keyof typeof CHAT_ROLE];

const ChatSessionIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(64));

export const ChatWishlistInputSchema = v.strictObject({
	wishlistShortId: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
});

export const ChatSessionInputSchema = v.strictObject({ sessionId: ChatSessionIdSchema });

/**
 * Names a chat runner turn before its request reaches the server, so a Stop that overtakes the
 * request still stops it.
 */
const ChatTurnIdSchema = v.optional(v.pipe(v.string(), v.uuid()));

/** Stop for the chat's unfinished turn, naming it when the panel started it. */
export const ChatStopInputSchema = v.strictObject({
	sessionId: ChatSessionIdSchema,
	turnId: ChatTurnIdSchema,
});

export const ChatFastForwardInputSchema = v.strictObject({
	sessionId: ChatSessionIdSchema,
	fastForward: v.boolean(),
});

export const CHAT_TURN_KIND = { message: 'message', retry: 'retry' } as const;

/** The Claude Code model aliases a chat runner turn may ask for. */
export const CHAT_RUNNER_MODELS = ['opus', 'sonnet', 'haiku'] as const;

export type ChatRunnerModel = (typeof CHAT_RUNNER_MODELS)[number];

export const DEFAULT_CHAT_RUNNER_MODEL: ChatRunnerModel = 'opus';

export function isChatRunnerModel(value: unknown): value is ChatRunnerModel {
	return CHAT_RUNNER_MODELS.some((model) => model === value);
}

/** The reasoning effort levels Claude Code's `--effort` accepts. */
export const CHAT_RUNNER_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type ChatRunnerEffort = (typeof CHAT_RUNNER_EFFORTS)[number];

/** Matches what the runner used before effort was selectable. */
export const DEFAULT_CHAT_RUNNER_EFFORT: ChatRunnerEffort = 'medium';

export function isChatRunnerEffort(value: unknown): value is ChatRunnerEffort {
	return CHAT_RUNNER_EFFORTS.some((effort) => effort === value);
}

/** Only a chat runner turn reads these; the model provider has its own configured model. */
const ChatRunnerModelSchema = v.optional(v.picklist(CHAT_RUNNER_MODELS));
const ChatRunnerEffortSchema = v.optional(v.picklist(CHAT_RUNNER_EFFORTS));

/** A turn: the user's message, or a retry of the last one after a failed answer. */
export const ChatTurnRequestSchema = v.variant('kind', [
	v.strictObject({
		kind: v.literal(CHAT_TURN_KIND.message),
		text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(CHAT_MESSAGE_MAX_LENGTH)),
		model: ChatRunnerModelSchema,
		effort: ChatRunnerEffortSchema,
		turnId: ChatTurnIdSchema,
	}),
	v.strictObject({
		kind: v.literal(CHAT_TURN_KIND.retry),
		model: ChatRunnerModelSchema,
		effort: ChatRunnerEffortSchema,
		turnId: ChatTurnIdSchema,
	}),
]);

export type ChatTurnRequest = v.InferOutput<typeof ChatTurnRequestSchema>;

export interface ChatSessionSummary {
	id: string;
	title: string;
	fastForward: boolean;
	createdAt: Date;
	lastTurnAt: Date;
}

export const CHAT_TOOL_STATUS = { running: 'running', ok: 'ok', error: 'error' } as const;

export type ChatToolStatus = (typeof CHAT_TOOL_STATUS)[keyof typeof CHAT_TOOL_STATUS];

/** Why a tool failed: the tool's or the provider's error code and its own short message. */
export const ChatToolErrorSchema = v.object({
	code: v.nullable(v.string()),
	message: v.nullable(v.string()),
});

export type ChatToolError = v.InferOutput<typeof ChatToolErrorSchema>;

export const CHAT_TOOL_SUMMARY = {
	page: 'page',
	searchResults: 'searchResults',
	proposal: 'proposal',
} as const;

const ChatToolCountSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** What a finished tool produced, in a few facts; never the content itself. */
export const ChatToolSummarySchema = v.variant('kind', [
	v.object({
		kind: v.literal(CHAT_TOOL_SUMMARY.page),
		characters: ChatToolCountSchema,
		truncated: v.boolean(),
	}),
	v.object({ kind: v.literal(CHAT_TOOL_SUMMARY.searchResults), count: ChatToolCountSchema }),
	v.object({ kind: v.literal(CHAT_TOOL_SUMMARY.proposal), applied: v.boolean() }),
]);

export type ChatToolSummary = v.InferOutput<typeof ChatToolSummarySchema>;

/**
 * The raw tool input and a truncated result, sent only to chat runner users (the owner) for
 * debugging and shown as plain text: the result may hold text a third-party page wrote.
 */
export interface ChatToolDebug {
	input: string;
	result: string | null;
}

/** How a finished tool call went. */
export interface ChatToolOutcome {
	status: typeof CHAT_TOOL_STATUS.ok | typeof CHAT_TOOL_STATUS.error;
	error: ChatToolError | null;
	durationMs: number | null;
	summary: ChatToolSummary | null;
	debug?: ChatToolDebug;
}

/** The outcome fields alone, of an event or a view that carries them. */
export function chatToolOutcome(source: ChatToolOutcome): ChatToolOutcome {
	return {
		status: source.status,
		error: source.error,
		durationMs: source.durationMs,
		summary: source.summary,
		...(source.debug === undefined ? {} : { debug: source.debug }),
	};
}

/**
 * One tool call the assistant made, as the panel's tool line and its details show it; a call
 * whose turn stopped before its result is still `running`.
 */
export interface ChatToolView extends Omit<ChatToolOutcome, 'status'> {
	id: string;
	name: string;
	/** The search query or page address. */
	query: string | null;
	status: ChatToolStatus;
}

/** What the client renders of a stored message: tool inputs and results stay server-side. */
export interface ChatMessageView {
	id: string;
	role: ChatRole;
	text: string;
	/** The tools the assistant used, in call order. */
	tools: ChatToolView[];
	proposalId: string | null;
	createdAt: Date;
}

export interface ChatSessionView extends ChatSessionSummary {
	wishlistShortId: string;
	messages: ChatMessageView[];
	/** Where the panel rejoins a turn still being answered, which `messages` show only in part. */
	activeTurnUrl: string | null;
}

/** Web tools the model runs itself; a tool event's query is the search query or the page URL. */
export const CHAT_WEB_TOOL = { search: 'web_search', fetch: 'web_fetch' } as const;

export type ChatWebToolName = (typeof CHAT_WEB_TOOL)[keyof typeof CHAT_WEB_TOOL];

export function isChatWebToolName(name: string): name is ChatWebToolName {
	return name === CHAT_WEB_TOOL.search || name === CHAT_WEB_TOOL.fetch;
}

/** The chat's own tool that opens a page in a headless browser; its tool event's query is the URL. */
export const CHAT_BROWSE_TOOL = 'browse_page';

/** The server-sent events of one streamed turn. */
export const CHAT_STREAM_EVENT = {
	text: 'text',
	/** A tool started: an operation name, or a web tool with its query. */
	tool: 'tool',
	/** A tool named by its `tool` event's id finished. */
	toolResult: 'toolResult',
	/** The turn proposed changes; the client loads the proposal by id. */
	proposal: 'proposal',
	error: 'error',
	done: 'done',
	/** A chat runner turn outlived one response: the turn goes on at `url`. */
	continue: 'continue',
} as const;

export const CHAT_TURN_ERROR = {
	/** The model provider failed; the user's message stays and the turn can be retried. */
	providerFailed: 'providerFailed',
	/** The turn hit its time or step limit before the assistant finished. */
	incomplete: 'incomplete',
	/** Claude Code on the owner's computer did not pick the turn up. */
	runnerOffline: 'runnerOffline',
} as const;

export type ChatTurnError = (typeof CHAT_TURN_ERROR)[keyof typeof CHAT_TURN_ERROR];

export type ChatStreamEvent =
	| { type: typeof CHAT_STREAM_EVENT.text; text: string }
	/** `id` pairs it with its `toolResult`; a tool without one never reports an outcome. */
	| { type: typeof CHAT_STREAM_EVENT.tool; id?: string; name: string; query: string | null }
	| ({ type: typeof CHAT_STREAM_EVENT.toolResult; id: string } & ChatToolOutcome)
	| { type: typeof CHAT_STREAM_EVENT.proposal; proposalId: string; applied: boolean }
	| { type: typeof CHAT_STREAM_EVENT.error; error: ChatTurnError }
	| { type: typeof CHAT_STREAM_EVENT.done };

/** What a chat runner turn streams: the turn's events, then where its stream continues. */
export type ChatRelayEvent =
	| ChatStreamEvent
	| { type: typeof CHAT_STREAM_EVENT.continue; url: string };
