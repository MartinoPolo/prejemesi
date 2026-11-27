import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { reportOperationalFailure } from '$lib/observability/operational_failures.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	CHAT_STREAM_EVENT,
	CHAT_TOOL_STATUS,
	CHAT_WEB_TOOL,
	ChatToolErrorSchema,
	ChatToolSummarySchema,
	chatToolOutcome,
	type ChatStreamEvent,
} from '$lib/modules/chat/types.js';
import { isDatabaseConnectionClosed } from '$lib/server/db/connection_errors.js';
import { generateId } from '$lib/server/db/id.js';
import { sha256Hex } from '$lib/server/crypto/sha256.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { bearerValue } from '$lib/server/agent_access/access_tokens.js';
import {
	AgentApiFailure,
	describeAgentApiFailure,
	readJsonBody,
} from '$lib/server/agent_access/api.js';
import {
	agentFailureResponse,
	handleMcpMessage,
	type McpToolset,
} from '$lib/server/agent_access/mcp_protocol.js';
import { scheduleAgentAccessPurge } from '$lib/server/agent_access/agent_access_purge.js';
import { chatCaller } from './chat_agent.js';
import { browsePageConfig, chatRunnerSecret } from './chat_config.js';
import { chatFailure } from './chat_failure.js';
import { CHAT_BLOCK, type ChatWebToolRecord } from './chat_model.js';
import { appToolOutcome, toolResultEvent } from './chat_tool_outcome.js';
import {
	CHAT_RUNNER_FINAL_STATUSES,
	CHAT_RUNNER_JOB_STATUS,
	appendChatRunnerJobEvents,
	applyChatRunnerReport,
	authenticateChatRunnerJob,
	claimChatRunnerJob,
	readChatRunnerJobChat,
	type ChatRunnerJob,
} from './chat_runner_jobs.js';
import { storeAssistantMessage } from './chat_store.js';
import { chatToolQuery, chatTools, runChatToolCalls } from './chat_tools.js';
import { CHAT_RUNNER_LIMITS, type ChatRunnerLimits } from './limits.js';
import { waitUnlessAborted } from './wait.js';

/**
 * The chat runner's HTTP API. The runner claims jobs with the operator's secret and reports each
 * job, and calls its tools, with the token issued at the claim.
 */

/** What the runner endpoints read from a SvelteKit request event. */
export interface ChatRunnerEvent {
	request: Request;
	url: URL;
	params: { jobId?: string };
	platform?: { env: { R2?: AgentImageBucket } };
}

/** The web tools Claude Code reports; the chat's own tools are reported by their endpoint. */
const RUNNER_WEB_TOOL_NAMES = [CHAT_WEB_TOOL.search, CHAT_WEB_TOOL.fetch] as const;

const NO_STORE = { 'cache-control': 'no-store' };

/** The largest report number the job's integer column holds. */
const REPORT_SEQUENCE_MAX = 2 ** 31 - 1;

const RunnerToolIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(200));
const RunnerQuerySchema = v.nullable(
	v.pipe(v.string(), v.maxLength(CHAT_RUNNER_LIMITS.queryMaxLength)),
);
const RunnerDebugTextSchema = v.pipe(
	v.string(),
	v.maxLength(CHAT_RUNNER_LIMITS.debugTextMaxLength),
);
const RUNNER_TOOL_ERROR_CODE_MAX_LENGTH = 100;
const [PageSummarySchema, SearchResultsSummarySchema] = ChatToolSummarySchema.options;

/** A web tool's outcome, with its name and query so the app can keep it in the chat. */
const RunnerToolResultSchema = v.strictObject({
	type: v.literal(CHAT_STREAM_EVENT.toolResult),
	id: RunnerToolIdSchema,
	name: v.picklist(RUNNER_WEB_TOOL_NAMES),
	query: RunnerQuerySchema,
	status: v.picklist([CHAT_TOOL_STATUS.ok, CHAT_TOOL_STATUS.error]),
	error: v.nullable(
		v.pipe(
			v.strictObject(ChatToolErrorSchema.entries),
			v.check(
				({ code, message }) =>
					(code?.length ?? 0) <= RUNNER_TOOL_ERROR_CODE_MAX_LENGTH &&
					(message?.length ?? 0) <= CHAT_RUNNER_LIMITS.toolErrorMaxLength,
			),
		),
	),
	durationMs: v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(0))),
	// The runner reports only web tools, which never propose changes.
	summary: v.nullable(
		v.variant('kind', [
			v.strictObject(PageSummarySchema.entries),
			v.strictObject(SearchResultsSummarySchema.entries),
		]),
	),
	debug: v.optional(
		v.strictObject({ input: RunnerDebugTextSchema, result: v.nullable(RunnerDebugTextSchema) }),
	),
});

type RunnerToolResult = v.InferOutput<typeof RunnerToolResultSchema>;

const RunnerReportSchema = v.strictObject({
	sequence: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(REPORT_SEQUENCE_MAX)),
	events: v.optional(
		v.pipe(
			v.array(
				v.variant('type', [
					v.strictObject({
						type: v.literal(CHAT_STREAM_EVENT.text),
						text: v.pipe(
							v.string(),
							v.minLength(1),
							v.maxLength(CHAT_RUNNER_LIMITS.textEventMaxLength),
						),
					}),
					v.strictObject({
						type: v.literal(CHAT_STREAM_EVENT.tool),
						id: v.optional(RunnerToolIdSchema),
						name: v.picklist(RUNNER_WEB_TOOL_NAMES),
						query: RunnerQuerySchema,
					}),
					RunnerToolResultSchema,
				]),
			),
			v.maxLength(CHAT_RUNNER_LIMITS.eventsPerReport),
		),
		[],
	),
	status: v.optional(v.picklist(CHAT_RUNNER_FINAL_STATUSES)),
});

const RUNNER_MCP_INSTRUCTIONS =
	'The tools of Přejeme si for the wishlist of this chat. They act as the chat’s user with exactly that user’s rights; every change tool call becomes a proposal the user reviews in the chat.';

function failure(status: number, code: string) {
	return chatFailure(status, code, { headers: NO_STORE });
}

function notFound() {
	return failure(404, SERVER_ERROR.NOT_FOUND);
}

function unauthorized() {
	return failure(401, SERVER_ERROR.UNAUTHORIZED);
}

function differsInConstantTime(left: Uint8Array, right: Uint8Array): boolean {
	let difference = left.length ^ right.length;
	for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference !== 0;
}

/** Compared as SHA-256 digests, so the comparison time tells nothing about the secret. */
async function presentsSecret(authorization: string | null, secret: string): Promise<boolean> {
	const presented = bearerValue(authorization);
	if (presented === null) {
		return false;
	}
	const [presentedHash, secretHash] = await Promise.all([
		sha256Hex(presented),
		sha256Hex(secret),
	]);
	const encoder = new TextEncoder();
	return !differsInConstantTime(encoder.encode(presentedHash), encoder.encode(secretHash));
}

async function claimChatRunnerJobUnlessConnectionClosed(limits: ChatRunnerLimits) {
	try {
		return await claimChatRunnerJob(limits);
	} catch (error) {
		if (!isDatabaseConnectionClosed(error)) {
			throw error;
		}
		// The per-request client reconnects on the next poll's query; a claim committed before the
		// socket closed is failed by the heartbeat timeout.
		reportOperationalFailure('database', 'chat_runner_claim_connection_closed', 'warning');
		return null;
	}
}

/**
 * `POST /chat-runner/claim`: waits one window for a job and hands the oldest to this runner with
 * its token, or answers 204 so the runner asks again.
 */
export async function handleChatRunnerClaim(
	event: ChatRunnerEvent,
	limits: ChatRunnerLimits = CHAT_RUNNER_LIMITS,
): Promise<Response> {
	const secret = chatRunnerSecret();
	if (secret === null) {
		return notFound();
	}
	if (!(await presentsSecret(event.request.headers.get('authorization'), secret))) {
		return unauthorized();
	}
	const hungUp = event.request.signal;
	const deadline = Date.now() + limits.claimWindowMs;
	// A runner that hung up must not claim a job it would never run.
	while (!hungUp.aborted) {
		const claimed = await claimChatRunnerJobUnlessConnectionClosed(limits);
		if (claimed !== null) {
			const { job, token } = claimed;
			return json(
				{
					id: job.id,
					token,
					model: job.model,
					effort: job.effort,
					systemPrompt: job.systemPrompt,
					prompt: job.prompt,
					// Tells the runner this app accepts tool ids and outcomes in its reports.
					reportsToolOutcomes: true,
					mcpUrl: new URL(
						`/chat-runner/jobs/${encodeURIComponent(job.id)}/mcp`,
						event.url.origin,
					).href,
				},
				{ headers: NO_STORE },
			);
		}
		if (Date.now() + limits.claimPollIntervalMs >= deadline) {
			break;
		}
		await waitUnlessAborted(limits.claimPollIntervalMs, hungUp);
	}
	return new Response(null, { status: 204 });
}

type RunnerReportEvent = v.InferOutput<typeof RunnerReportSchema>['events'][number];

/** A reported web tool outcome kept in the chat, so its tool line survives a reload. */
function runnerWebToolRecord(event: RunnerToolResult): ChatWebToolRecord {
	return {
		type: CHAT_BLOCK.webTool,
		id: event.id,
		name: event.name,
		query: event.query,
		isError: event.status === CHAT_TOOL_STATUS.error,
		error: event.error,
		summary: event.summary,
		durationMs: event.durationMs,
		debug: event.debug ?? null,
	};
}

/** What the browser gets of a reported event: a tool outcome without the name its line has. */
function runnerStreamEvent(event: RunnerReportEvent): ChatStreamEvent {
	if (event.type !== CHAT_STREAM_EVENT.toolResult) {
		return event;
	}
	return { type: event.type, id: event.id, ...chatToolOutcome(event) };
}

/** The job the request's token was issued for, or the response refusing the request. */
async function authenticatedJob(event: ChatRunnerEvent): Promise<ChatRunnerJob | Response> {
	if (chatRunnerSecret() === null) {
		return notFound();
	}
	const job = await authenticateChatRunnerJob(
		event.params.jobId ?? '',
		event.request.headers.get('authorization'),
	);
	return job ?? unauthorized();
}

/**
 * `POST /chat-runner/jobs/<id>/events`: the runner's report, also its heartbeat. Text joins the
 * chat as the assistant's messages; the answer tells the runner whether to stop.
 */
export async function handleChatRunnerEvents(event: ChatRunnerEvent): Promise<Response> {
	const job = await authenticatedJob(event);
	if (job instanceof Response) {
		return job;
	}
	let report: v.InferOutput<typeof RunnerReportSchema>;
	try {
		const parsed = v.safeParse(RunnerReportSchema, (await readJsonBody(event.request)).parsed);
		if (!parsed.success) {
			return failure(400, SERVER_ERROR.BAD_REQUEST);
		}
		report = parsed.output;
	} catch (thrown) {
		const { status, body } = describeAgentApiFailure(thrown);
		return failure(status, body.error.code);
	}
	const running = await applyChatRunnerReport(job, {
		sequence: report.sequence,
		events: report.events.map(runnerStreamEvent),
		webTools: new Map(
			report.events.flatMap((reported) =>
				reported.type === CHAT_STREAM_EVENT.toolResult
					? [[reported.id, runnerWebToolRecord(reported)] as const]
					: [],
			),
		),
		finalStatus: report.status ?? null,
	});
	return json({ cancelled: !running }, { headers: NO_STORE });
}

async function chatRunnerToolset(
	job: ChatRunnerJob,
	imageBucket: AgentImageBucket | undefined,
	signal: AbortSignal,
): Promise<McpToolset> {
	const chat = await readChatRunnerJobChat(job.sessionId);
	if (chat === null) {
		throw new AgentApiFailure(404, SERVER_ERROR.NOT_FOUND);
	}
	const caller = chatCaller(chat.session, chat.user);
	const tools = chatTools(caller, browsePageConfig());
	const toolNames = new Set(tools.map((tool) => tool.name));
	return {
		instructions: RUNNER_MCP_INSTRUCTIONS,
		listTools: () =>
			tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
		hasTool: (name) => toolNames.has(name),
		callTool: async (name, toolArguments) => {
			const appendEvents = (events: ChatStreamEvent[]) =>
				appendChatRunnerJobEvents(job.id, events);
			const call = { id: `runner_${generateId()}`, name, input: toolArguments };
			await appendEvents([
				{ type: CHAT_STREAM_EVENT.tool, id: call.id, name, query: chatToolQuery(call) },
			]);
			const round = await runChatToolCalls(caller, tools, chat.session.wishlistId, [call], {
				imageBucket,
				signal,
				// Owner-only, and the runner's own WebFetch opens any address, so a restriction
				// here would not close the channel the API chat's restriction closes.
				conversationUrls: null,
			});
			await storeAssistantMessage(
				job.sessionId,
				[{ type: CHAT_BLOCK.toolCall, ...call }, ...round.results],
				round.proposal?.id ?? null,
			);
			const [result] = round.results;
			// Only chat runner users reach this endpoint, so the outcome carries its debug view.
			const outcomes =
				result === undefined
					? []
					: [toolResultEvent(call.id, appToolOutcome(call, result, true))];
			if (round.proposal === null) {
				await appendEvents(outcomes);
			} else {
				scheduleAgentAccessPurge();
				await appendEvents([
					...outcomes,
					{
						type: CHAT_STREAM_EVENT.proposal,
						proposalId: round.proposal.id,
						applied: round.proposal.applied,
					},
				]);
			}
			return result !== undefined
				? { content: [{ type: 'text', text: result.content }], isError: result.isError }
				: {
						content: [{ type: 'text', text: 'The tool returned no result.' }],
						isError: true,
					};
		},
	};
}

/**
 * `POST /chat-runner/jobs/<id>/mcp`: the chat's tools over MCP for Claude Code, acting as the
 * chat's user with the chat's current fast-forward, while the job runs.
 */
export async function handleChatRunnerMcp(event: ChatRunnerEvent): Promise<Response> {
	const job = await authenticatedJob(event);
	if (job instanceof Response) {
		return job;
	}
	return handleMcpMessage(event.request, {
		authenticate: () => {
			if (job.status !== CHAT_RUNNER_JOB_STATUS.running) {
				throw new AgentApiFailure(409, SERVER_ERROR.CONFLICT);
			}
			return chatRunnerToolset(job, event.platform?.env.R2, event.request.signal);
		},
		failureResponse: (thrown) => agentFailureResponse(null, thrown),
	});
}
