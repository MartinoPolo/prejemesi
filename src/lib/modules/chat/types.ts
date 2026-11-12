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
	}),
	v.strictObject({
		kind: v.literal(CHAT_TURN_KIND.retry),
		model: ChatRunnerModelSchema,
		effort: ChatRunnerEffortSchema,
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

/** What the client renders of a stored message: tool results and calls stay server-side. */
export interface ChatMessageView {
	id: string;
	role: ChatRole;
	text: string;
	/** The tools the assistant used, as short status lines. */
	toolNames: string[];
	proposalId: string | null;
	createdAt: Date;
}

export interface ChatSessionView extends ChatSessionSummary {
	wishlistShortId: string;
	messages: ChatMessageView[];
}

/** The server-sent events of one streamed turn. */
export const CHAT_STREAM_EVENT = {
	text: 'text',
	/** A tool started: an operation name, or `web_search` with its query. */
	tool: 'tool',
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
	| { type: typeof CHAT_STREAM_EVENT.tool; name: string; query: string | null }
	| { type: typeof CHAT_STREAM_EVENT.proposal; proposalId: string; applied: boolean }
	| { type: typeof CHAT_STREAM_EVENT.error; error: ChatTurnError }
	| { type: typeof CHAT_STREAM_EVENT.done };

/** What a chat runner turn streams: the turn's events, then where its stream continues. */
export type ChatRelayEvent =
	| ChatStreamEvent
	| { type: typeof CHAT_STREAM_EVENT.continue; url: string };
