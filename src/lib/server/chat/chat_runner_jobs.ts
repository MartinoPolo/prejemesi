import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { chatRunnerJob, chatSession } from '$lib/server/db/chat.schema.js';
import { user } from '$lib/server/db/auth.schema.js';
import { toBase64Url } from '$lib/server/crypto/hmac.js';
import { sha256Hex } from '$lib/server/crypto/sha256.js';
import { bearerValue } from '$lib/server/agent_access/access_tokens.js';
import {
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	type ChatStreamEvent,
} from '$lib/modules/chat/types.js';
import { CHAT_BLOCK } from './chat_model.js';
import { storeAssistantMessage } from './chat_store.js';
import type { ChatRunnerLimits } from './limits.js';

export const CHAT_RUNNER_JOB_STATUS = {
	/** Waiting for the runner to claim it. */
	pending: 'pending',
	running: 'running',
	done: 'done',
	failed: 'failed',
	/** The user stopped the turn. */
	cancelled: 'cancelled',
} as const;

export type ChatRunnerJobStatus =
	(typeof CHAT_RUNNER_JOB_STATUS)[keyof typeof CHAT_RUNNER_JOB_STATUS];

/** How the runner ends a job it ran. */
export const CHAT_RUNNER_FINAL_STATUSES = [
	CHAT_RUNNER_JOB_STATUS.done,
	CHAT_RUNNER_JOB_STATUS.failed,
] as const;

export type ChatRunnerFinalStatus = (typeof CHAT_RUNNER_FINAL_STATUSES)[number];

const ACTIVE_STATUSES: ChatRunnerJobStatus[] = [
	CHAT_RUNNER_JOB_STATUS.pending,
	CHAT_RUNNER_JOB_STATUS.running,
];

export type ChatRunnerJob = typeof chatRunnerJob.$inferSelect;

const JOB_TOKEN_RANDOM_BYTES = 32;

export function isActiveChatRunnerJob(job: Pick<ChatRunnerJob, 'status'>): boolean {
	return ACTIVE_STATUSES.includes(job.status);
}

export async function createChatRunnerJob(
	values: {
		sessionId: string;
		model: string;
		effort: string;
		systemPrompt: string;
		prompt: string;
	},
	now = new Date(),
): Promise<ChatRunnerJob> {
	const [created] = await getDb()
		.insert(chatRunnerJob)
		.values({
			...values,
			status: CHAT_RUNNER_JOB_STATUS.pending,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	if (created === undefined) {
		throw new Error('Inserting the chat runner job returned no row');
	}
	return created;
}

export async function readChatRunnerJob(
	sessionId: string,
	jobId: string,
): Promise<ChatRunnerJob | null> {
	const [job] = await getDb()
		.select()
		.from(chatRunnerJob)
		.where(and(eq(chatRunnerJob.id, jobId), eq(chatRunnerJob.sessionId, sessionId)))
		.limit(1);
	return job ?? null;
}

/** Why an active job can no longer finish, or null while it still can. */
function staleJobError(job: ChatRunnerJob, now: Date, limits: ChatRunnerLimits) {
	const age = now.getTime() - job.createdAt.getTime();
	if (job.status === CHAT_RUNNER_JOB_STATUS.pending) {
		return age >= limits.runnerOfflineMs ? CHAT_TURN_ERROR.runnerOffline : null;
	}
	if (job.status !== CHAT_RUNNER_JOB_STATUS.running) {
		return null;
	}
	if (age >= limits.turnTimeoutMs) {
		return CHAT_TURN_ERROR.incomplete;
	}
	const silence = now.getTime() - job.updatedAt.getTime();
	return silence >= limits.heartbeatTimeoutMs ? CHAT_TURN_ERROR.providerFailed : null;
}

/**
 * Fails a job that can no longer finish: never claimed, silent or over time. Answers the job as
 * it stands now. The token stays, so a runner still at work learns the job was stopped.
 */
export async function settleChatRunnerJob(
	job: ChatRunnerJob,
	limits: ChatRunnerLimits,
	now = new Date(),
): Promise<ChatRunnerJob> {
	const error = staleJobError(job, now, limits);
	if (error === null) {
		return job;
	}
	const [settled] = await getDb()
		.update(chatRunnerJob)
		.set({ status: CHAT_RUNNER_JOB_STATUS.failed, error, finishedAt: now })
		.where(and(eq(chatRunnerJob.id, job.id), eq(chatRunnerJob.status, job.status)))
		.returning();
	return settled ?? (await readChatRunnerJob(job.sessionId, job.id)) ?? job;
}

/** Whether the chat has a turn the runner has not finished yet; stale ones are failed first. */
export async function hasActiveChatRunnerJob(
	sessionId: string,
	limits: ChatRunnerLimits,
	now = new Date(),
): Promise<boolean> {
	const active = await getDb()
		.select()
		.from(chatRunnerJob)
		.where(
			and(
				eq(chatRunnerJob.sessionId, sessionId),
				inArray(chatRunnerJob.status, ACTIVE_STATUSES),
			),
		)
		.orderBy(desc(chatRunnerJob.createdAt));
	for (const job of active) {
		if (isActiveChatRunnerJob(await settleChatRunnerJob(job, limits, now))) {
			return true;
		}
	}
	return false;
}

export async function cancelChatRunnerJob(jobId: string, now = new Date()): Promise<void> {
	await getDb()
		.update(chatRunnerJob)
		.set({ status: CHAT_RUNNER_JOB_STATUS.cancelled, finishedAt: now })
		.where(and(eq(chatRunnerJob.id, jobId), inArray(chatRunnerJob.status, ACTIVE_STATUSES)));
}

/**
 * Claims the oldest job still waiting, atomically even between concurrent runners, and issues
 * the token the runner reports with; only its hash is stored. A job older than the offline limit
 * already told its user the runner is offline, so it is left to fail.
 */
export async function claimChatRunnerJob(
	limits: ChatRunnerLimits,
	now = new Date(),
): Promise<{ job: ChatRunnerJob; token: string } | null> {
	const token = toBase64Url(crypto.getRandomValues(new Uint8Array(JOB_TOKEN_RANDOM_BYTES)));
	const oldestPending = getDb()
		.select({ id: chatRunnerJob.id })
		.from(chatRunnerJob)
		.where(
			and(
				eq(chatRunnerJob.status, CHAT_RUNNER_JOB_STATUS.pending),
				gt(chatRunnerJob.createdAt, new Date(now.getTime() - limits.runnerOfflineMs)),
			),
		)
		.orderBy(asc(chatRunnerJob.createdAt))
		.limit(1)
		.for('update', { skipLocked: true });
	// Compared with `=`, the locking subquery runs once as a scalar; inside `IN` the planner may
	// join it and run it again, claiming more than the one row its LIMIT names.
	const [job] = await getDb()
		.update(chatRunnerJob)
		.set({
			status: CHAT_RUNNER_JOB_STATUS.running,
			claimedAt: now,
			updatedAt: now,
			tokenHash: await sha256Hex(token),
		})
		.where(
			and(
				eq(chatRunnerJob.id, sql`(${oldestPending})`),
				eq(chatRunnerJob.status, CHAT_RUNNER_JOB_STATUS.pending),
			),
		)
		.returning();
	return job === undefined ? null : { job, token };
}

/** The job a runner's bearer token was issued for, whatever its status now. */
export async function authenticateChatRunnerJob(
	jobId: string,
	authorization: string | null,
): Promise<ChatRunnerJob | null> {
	const token = bearerValue(authorization);
	if (token === null) {
		return null;
	}
	const [job] = await getDb()
		.select()
		.from(chatRunnerJob)
		.where(
			and(eq(chatRunnerJob.id, jobId), eq(chatRunnerJob.tokenHash, await sha256Hex(token))),
		)
		.limit(1);
	return job ?? null;
}

function appendedEvents(events: readonly ChatStreamEvent[]) {
	return sql`${chatRunnerJob.events} || ${JSON.stringify(events)}::jsonb`;
}

/** Appends events the server itself records for a running job, such as its tool calls. */
export async function appendChatRunnerJobEvents(
	jobId: string,
	events: readonly ChatStreamEvent[],
	now = new Date(),
): Promise<void> {
	await getDb()
		.update(chatRunnerJob)
		.set({ events: appendedEvents(events), updatedAt: now })
		.where(
			and(
				eq(chatRunnerJob.id, jobId),
				eq(chatRunnerJob.status, CHAT_RUNNER_JOB_STATUS.running),
			),
		);
}

export interface ChatRunnerReport {
	/** Numbers the runner's reports of one job in order; a retry repeats its number. */
	sequence: number;
	events: readonly ChatStreamEvent[];
	finalStatus: ChatRunnerFinalStatus | null;
}

/**
 * Applies a runner's report to its running job at once: appends its events, keeps its text as
 * the assistant's messages and counts as the heartbeat; a final status ends the job and retires
 * its token. A retried report already applied changes nothing. Answers whether the job was
 * still running, so the runner learns when to stop.
 */
export async function applyChatRunnerReport(
	job: Pick<ChatRunnerJob, 'id' | 'sessionId'>,
	report: ChatRunnerReport,
	now = new Date(),
): Promise<boolean> {
	const { finalStatus } = report;
	const ending =
		finalStatus === null
			? {}
			: {
					status: finalStatus,
					error:
						finalStatus === CHAT_RUNNER_JOB_STATUS.failed
							? CHAT_TURN_ERROR.providerFailed
							: null,
					finishedAt: now,
					tokenHash: null,
				};
	return getDb().transaction(async (transaction) => {
		const [applied] = await transaction
			.update(chatRunnerJob)
			.set({
				events: appendedEvents(report.events),
				reportSequence: report.sequence,
				updatedAt: now,
				...ending,
			})
			.where(
				and(
					eq(chatRunnerJob.id, job.id),
					eq(chatRunnerJob.status, CHAT_RUNNER_JOB_STATUS.running),
					lt(chatRunnerJob.reportSequence, report.sequence),
				),
			)
			.returning({ id: chatRunnerJob.id });
		if (applied === undefined) {
			const [current] = await transaction
				.select({ status: chatRunnerJob.status })
				.from(chatRunnerJob)
				.where(eq(chatRunnerJob.id, job.id));
			return current?.status === CHAT_RUNNER_JOB_STATUS.running;
		}
		for (const event of report.events) {
			if (event.type === CHAT_STREAM_EVENT.text) {
				await storeAssistantMessage(
					job.sessionId,
					[{ type: CHAT_BLOCK.text, text: event.text }],
					null,
					now,
					transaction,
				);
			}
		}
		return true;
	});
}

/** Who a job's chat acts for, with the chat's settings as they are now. */
export async function readChatRunnerJobChat(sessionId: string) {
	const [chat] = await getDb()
		.select({
			session: {
				id: chatSession.id,
				wishlistId: chatSession.wishlistId,
				fastForward: chatSession.fastForward,
			},
			user: { id: user.id, name: user.name },
		})
		.from(chatSession)
		.innerJoin(user, eq(user.id, chatSession.userId))
		.where(eq(chatSession.id, sessionId))
		.limit(1);
	return chat ?? null;
}
