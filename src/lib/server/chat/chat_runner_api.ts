import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { CHAT_STREAM_EVENT, type ChatStreamEvent } from '$lib/modules/chat/types.js';
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
import { chatRunnerSecret } from './chat_config.js';
import { chatFailure } from './chat_failure.js';
import { CHAT_BLOCK } from './chat_model.js';
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
import { chatTools, runChatToolCalls } from './chat_tools.js';
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
const RUNNER_WEB_TOOL_NAMES = ['web_search', 'web_fetch'] as const;

const NO_STORE = { 'cache-control': 'no-store' };

/** The largest report number the job's integer column holds. */
const REPORT_SEQUENCE_MAX = 2 ** 31 - 1;

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
						name: v.picklist(RUNNER_WEB_TOOL_NAMES),
						query: v.nullable(
							v.pipe(v.string(), v.maxLength(CHAT_RUNNER_LIMITS.queryMaxLength)),
						),
					}),
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
		const claimed = await claimChatRunnerJob(limits);
		if (claimed !== null) {
			const { job, token } = claimed;
			return json(
				{
					id: job.id,
					token,
					model: job.model,
					systemPrompt: job.systemPrompt,
					prompt: job.prompt,
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
		events: report.events,
		finalStatus: report.status ?? null,
	});
	return json({ cancelled: !running }, { headers: NO_STORE });
}

async function chatRunnerToolset(
	job: ChatRunnerJob,
	imageBucket: AgentImageBucket | undefined,
): Promise<McpToolset> {
	const chat = await readChatRunnerJobChat(job.sessionId);
	if (chat === null) {
		throw new AgentApiFailure(404, SERVER_ERROR.NOT_FOUND);
	}
	const caller = chatCaller(chat.session, chat.user);
	const tools = chatTools(caller);
	const toolNames = new Set(tools.map((tool) => tool.name));
	return {
		instructions: RUNNER_MCP_INSTRUCTIONS,
		listTools: () =>
			tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
		hasTool: (name) => toolNames.has(name),
		callTool: async (name, toolArguments) => {
			const appendEvents = (events: ChatStreamEvent[]) =>
				appendChatRunnerJobEvents(job.id, events);
			await appendEvents([{ type: CHAT_STREAM_EVENT.tool, name, query: null }]);
			const call = { id: `runner_${generateId()}`, name, input: toolArguments };
			const round = await runChatToolCalls(
				caller,
				tools,
				chat.session.wishlistId,
				[call],
				imageBucket,
			);
			await storeAssistantMessage(
				job.sessionId,
				[{ type: CHAT_BLOCK.toolCall, ...call }, ...round.results],
				round.proposal?.id ?? null,
			);
			if (round.proposal !== null) {
				scheduleAgentAccessPurge();
				await appendEvents([
					{
						type: CHAT_STREAM_EVENT.proposal,
						proposalId: round.proposal.id,
						applied: round.proposal.applied,
					},
				]);
			}
			const [result] = round.results;
			return result?.type === CHAT_BLOCK.toolResult
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
			return chatRunnerToolset(job, event.platform?.env.R2);
		},
		failureResponse: (thrown) => agentFailureResponse(null, thrown),
	});
}
