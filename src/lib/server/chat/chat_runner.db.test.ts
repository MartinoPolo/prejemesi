import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	createWishlistFixture,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ChatAvailabilityModule from './chat_availability.js';
import type * as ChatConfigModule from './chat_config.js';

const chatSwitches = vi.hoisted(() => ({
	runner: true,
	secret: 'runner-secret' as string | null,
}));

vi.mock('./chat_config.js', async (importOriginal) => ({
	...(await importOriginal<typeof ChatConfigModule>()),
	isChatAllowedFor: vi.fn(() => true),
	isChatKillSwitchOn: vi.fn(() => false),
	isChatRunnerUser: vi.fn(() => chatSwitches.runner),
	chatRunnerSecret: vi.fn(() => chatSwitches.secret),
}));

// The daily caps count every user's messages, which chat.db.test.ts fills in parallel; the caps
// are tested there.
vi.mock('./chat_availability.js', async (importOriginal) => ({
	...(await importOriginal<typeof ChatAvailabilityModule>()),
	chatAvailability: vi.fn(() => Promise.resolve('available')),
}));

import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { runAfterResponse } from '$lib/server/background.js';
import { getDb } from '$lib/server/db/index.js';
import { chatMessage, chatRunnerJob } from '$lib/server/db/chat.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { OPERATION_CHANNEL } from '$lib/server/operations/actor.js';
import {
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	CHAT_TURN_KIND,
	type ChatRelayEvent,
	type ChatTurnRequest,
} from '$lib/modules/chat/types.js';
import { handleChatTurnContinuation, handleChatTurnRequest } from './chat_endpoint.js';
import {
	handleChatRunnerClaim,
	handleChatRunnerEvents,
	handleChatRunnerMcp,
} from './chat_runner_api.js';
import { CHAT_RUNNER_JOB_STATUS, createChatRunnerJob } from './chat_runner_jobs.js';
import { CHAT_BLOCK, CHAT_ROLE } from './chat_model.js';
import { readChatContext } from './chat_prompt.js';
import { createChatSession, setChatFastForward } from './chat_store.js';
import { createFakeProvider } from './fake_provider.js';
import { CHAT_RUNNER_LIMITS, chatDayStart, type ChatRunnerLimits } from './limits.js';

const MANAGER = { id: MANAGER_ID, name: 'Manager', email: 'manager@example.com' };
const ORIGIN = 'https://prejemesi.cz';

/** Short windows, so a relay or a claim answers within a test. */
const TEST_LIMITS: ChatRunnerLimits = {
	...CHAT_RUNNER_LIMITS,
	relayWindowMs: 60,
	relayPollIntervalMs: 15,
	claimWindowMs: 40,
	claimPollIntervalMs: 10,
};

const CHAT_RUNNER_TEST_DAY_OFFSET_MS = 2 * 24 * 60 * 60 * 1000;

const createdSessionIds: string[] = [];

async function newChat(userId = MANAGER_ID) {
	const wishlist = await createWishlistFixture();
	const session = await createChatSession(userId, wishlist.id);
	createdSessionIds.push(session.id);
	return { wishlist, session };
}

function postTurn(sessionId: string, request: ChatTurnRequest): Promise<Response> {
	return handleChatTurnRequest(
		{
			request: new Request(`${ORIGIN}/chat/${sessionId}/turns`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
			}),
			params: { sessionId },
			locals: { user: MANAGER },
		},
		createFakeProvider,
		TEST_LIMITS,
	);
}

function continueTurn(url: string, user: { id: string } | null = MANAGER): Promise<Response> {
	const parsed = new URL(url, ORIGIN);
	const [, , sessionId, , jobId] = parsed.pathname.split('/');
	return handleChatTurnContinuation(
		{ url: parsed, params: { sessionId, jobId }, locals: { user: user ?? undefined } },
		TEST_LIMITS,
	);
}

async function streamedEvents(response: Response): Promise<ChatRelayEvent[]> {
	expect(response.headers.get('content-type')).toContain('text/event-stream');
	const text = await response.text();
	return text
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as ChatRelayEvent);
}

function runnerRequest(path: string, authorization: string | null, body?: unknown) {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (authorization !== null) {
		headers.authorization = authorization;
	}
	return new Request(`${ORIGIN}${path}`, {
		method: 'POST',
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

function claim(authorization: string | null = `Bearer ${chatSwitches.secret ?? ''}`) {
	return handleChatRunnerClaim(
		{
			request: runnerRequest('/chat-runner/claim', authorization),
			url: new URL(`${ORIGIN}/chat-runner/claim`),
			params: {},
		},
		TEST_LIMITS,
	);
}

interface ClaimedJob {
	id: string;
	token: string;
	model: string;
	systemPrompt: string;
	prompt: string;
	mcpUrl: string;
}

async function claimJob(): Promise<ClaimedJob> {
	const response = await claim();
	expect(response.status).toBe(200);
	return (await response.json()) as ClaimedJob;
}

let lastReportSequence = 0;

/** A runner report; numbered after every earlier one unless the body names its sequence. */
function reportEvents(jobId: string, token: string, body: object): Promise<Response> {
	const path = `/chat-runner/jobs/${jobId}/events`;
	lastReportSequence += 1;
	return handleChatRunnerEvents({
		request: runnerRequest(path, `Bearer ${token}`, { sequence: lastReportSequence, ...body }),
		url: new URL(`${ORIGIN}${path}`),
		params: { jobId },
	});
}

let mcpRequestId = 0;

async function callMcp(jobId: string, token: string | null, method: string, params: unknown) {
	mcpRequestId += 1;
	const path = `/chat-runner/jobs/${jobId}/mcp`;
	return handleChatRunnerMcp({
		request: runnerRequest(path, token === null ? null : `Bearer ${token}`, {
			jsonrpc: '2.0',
			id: mcpRequestId,
			method,
			params,
		}),
		url: new URL(`${ORIGIN}${path}`),
		params: { jobId },
	});
}

function createJobForChat(sessionId: string, createdAt = new Date()) {
	return createChatRunnerJob(
		{ sessionId, model: 'opus', systemPrompt: 'system', prompt: 'prompt' },
		createdAt,
	);
}

async function readJob(jobId: string) {
	const [job] = await getDb().select().from(chatRunnerJob).where(eq(chatRunnerJob.id, jobId));
	if (job === undefined) {
		throw new Error(`No job ${jobId}`);
	}
	return job;
}

async function sessionJobs(sessionId: string) {
	return getDb()
		.select()
		.from(chatRunnerJob)
		.where(eq(chatRunnerJob.sessionId, sessionId))
		.orderBy(asc(chatRunnerJob.createdAt));
}

async function storedMessages(sessionId: string) {
	return getDb()
		.select()
		.from(chatMessage)
		.where(eq(chatMessage.sessionId, sessionId))
		.orderBy(asc(chatMessage.sequence));
}

/** A runner turn, posted and claimed, with its relay's first window read. */
async function startClaimedTurn(text = 'Přidejte kolo') {
	const { wishlist, session } = await newChat();
	await streamedEvents(await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text }));
	const job = await claimJob();
	return { wishlist, session, job };
}

describe.skipIf(!DB_READY)('chat runner turns', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);
	beforeEach(() => {
		chatSwitches.runner = true;
		chatSwitches.secret = 'runner-secret';
		// The shared database setup drops background work, but the relay streams from it.
		vi.mocked(runAfterResponse).mockImplementation((task) => void task());
		// chat.db.test.ts counts every user's messages since today's start in parallel; these
		// turns store theirs on an earlier day so they do not move that count. Only Date is
		// faked, so polling windows still elapse.
		vi.useFakeTimers({
			toFake: ['Date'],
			now: Date.now() - CHAT_RUNNER_TEST_DAY_OFFSET_MS,
			shouldAdvanceTime: true,
		});
	});
	// Each test leaves no job waiting, so the next claim takes that test's own job.
	afterEach(async () => {
		vi.useRealTimers();
		if (createdSessionIds.length > 0) {
			const storedSinceToday = await getDb()
				.select({ id: chatMessage.id })
				.from(chatMessage)
				.where(
					and(
						inArray(chatMessage.sessionId, createdSessionIds),
						gte(chatMessage.createdAt, chatDayStart(new Date())),
					),
				);
			expect(storedSinceToday, 'messages stored before today’s cap day').toEqual([]);
			await getDb()
				.update(chatRunnerJob)
				.set({ status: CHAT_RUNNER_JOB_STATUS.cancelled })
				.where(
					and(
						inArray(chatRunnerJob.sessionId, createdSessionIds),
						inArray(chatRunnerJob.status, [
							CHAT_RUNNER_JOB_STATUS.pending,
							CHAT_RUNNER_JOB_STATUS.running,
						]),
					),
				);
		}
	});

	it('stores the message, queues a job for the runner and hands the stream on', async () => {
		const { wishlist, session } = await newChat();

		const events = await streamedEvents(
			await postTurn(session.id, {
				kind: CHAT_TURN_KIND.message,
				text: 'Přidejte kolo',
				model: 'sonnet',
			}),
		);

		const [job, ...others] = await sessionJobs(session.id);
		expect(others).toEqual([]);
		expect(job).toMatchObject({ status: CHAT_RUNNER_JOB_STATUS.pending, model: 'sonnet' });
		expect(job?.prompt).toContain('Přidejte kolo');
		expect(readChatContext(job?.systemPrompt ?? '')).toMatchObject({
			wishlistId: wishlist.id,
			userName: MANAGER.name,
		});
		expect(events).toEqual([
			{
				type: CHAT_STREAM_EVENT.continue,
				url: `/chat/${session.id}/turns/${job?.id ?? ''}?cursor=0`,
			},
		]);
		const messages = await storedMessages(session.id);
		expect(messages.map((message) => [message.role, message.content])).toEqual([
			[CHAT_ROLE.user, [{ type: CHAT_BLOCK.text, text: 'Přidejte kolo' }]],
		]);
	});

	it('asks Claude Code for Opus unless the turn names a model', async () => {
		const { session } = await newChat();

		await streamedEvents(
			await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Ahoj' }),
		);

		const [job] = await sessionJobs(session.id);
		expect(job?.model).toBe('opus');
	});

	it('refuses a second turn while the runner still has one of the chat', async () => {
		const { session } = await newChat();
		await streamedEvents(
			await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Ahoj' }),
		);

		const second = await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Haló' });

		expect(second.status).toBe(409);
		expect(await sessionJobs(session.id)).toHaveLength(1);
		expect((await storedMessages(session.id)).map((message) => message.role)).toEqual([
			CHAT_ROLE.user,
		]);
	});

	it('accepts a new turn once the runner finished the previous one', async () => {
		const { session, job } = await startClaimedTurn('Ahoj');
		await reportEvents(job.id, job.token, { status: 'done' });

		const next = await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Haló' });

		expect(next.status).toBe(200);
		await streamedEvents(next);
		expect((await sessionJobs(session.id)).map((stored) => stored.status)).toEqual([
			CHAT_RUNNER_JOB_STATUS.done,
			CHAT_RUNNER_JOB_STATUS.pending,
		]);
	});

	it('accepts a new turn once the unclaimed previous one found the runner offline', async () => {
		const { session } = await newChat();
		const stale = await createJobForChat(
			session.id,
			new Date(Date.now() - CHAT_RUNNER_LIMITS.runnerOfflineMs - 1000),
		);

		const next = await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Haló' });

		expect(next.status).toBe(200);
		await streamedEvents(next);
		expect(await readJob(stale.id)).toMatchObject({
			status: CHAT_RUNNER_JOB_STATUS.failed,
			error: CHAT_TURN_ERROR.runnerOffline,
		});
		expect(await sessionJobs(session.id)).toHaveLength(2);
	});

	it('answers a model provider turn as before for users outside the runner list', async () => {
		chatSwitches.runner = false;
		const { session } = await newChat();

		const events = await streamedEvents(
			await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Přidejte kolo' }),
		);

		expect(events.at(-1)).toEqual({ type: CHAT_STREAM_EVENT.done });
		expect(events.map((event) => event.type)).toContain(CHAT_STREAM_EVENT.proposal);
		expect(await sessionJobs(session.id)).toEqual([]);
	});

	it('hands a job to the runner holding the secret, once', async () => {
		const { session } = await newChat();
		await streamedEvents(
			await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Ahoj' }),
		);
		const [queued] = await sessionJobs(session.id);

		expect((await claim(null)).status).toBe(401);
		expect((await claim('Bearer wrong-secret')).status).toBe(401);
		const claimed = await claimJob();
		const again = await claim();

		expect(claimed).toMatchObject({
			id: queued?.id,
			model: 'opus',
			systemPrompt: queued?.systemPrompt,
			prompt: queued?.prompt,
			mcpUrl: `${ORIGIN}/chat-runner/jobs/${queued?.id ?? ''}/mcp`,
		});
		expect(claimed.token).toEqual(expect.any(String));
		expect(again.status).toBe(204);
		const job = await readJob(claimed.id);
		expect(job.status).toBe(CHAT_RUNNER_JOB_STATUS.running);
		expect(job.tokenHash).not.toBeNull();
		expect(job.tokenHash).not.toBe(claimed.token);
	});

	it('hands one job to only one of two runners claiming at once', async () => {
		const { session } = await newChat();
		const queued = await createJobForChat(session.id);

		const responses = await Promise.all([claim(), claim()]);

		expect(
			responses.map((response) => response.status).sort((left, right) => left - right),
		).toEqual([200, 204]);
		const claimed = responses.find((response) => response.status === 200);
		expect(await claimed?.json()).toMatchObject({ id: queued.id });
	});

	it('hands out the oldest waiting job first', async () => {
		const older = await createJobForChat(
			(await newChat()).session.id,
			new Date(Date.now() - 2000),
		);
		const newer = await createJobForChat(
			(await newChat()).session.id,
			new Date(Date.now() - 1000),
		);

		expect((await claimJob()).id).toBe(older.id);
		expect((await claimJob()).id).toBe(newer.id);
	});

	it('does not hand out a job that already told its user the runner is offline', async () => {
		const { session } = await newChat();
		const stale = await createJobForChat(
			session.id,
			new Date(Date.now() - CHAT_RUNNER_LIMITS.runnerOfflineMs - 1000),
		);

		expect((await claim()).status).toBe(204);
		expect((await readJob(stale.id)).status).toBe(CHAT_RUNNER_JOB_STATUS.pending);
	});

	it('hides every runner endpoint while no runner secret is configured', async () => {
		const { job } = await startClaimedTurn();
		chatSwitches.secret = null;

		expect((await claim('Bearer runner-secret')).status).toBe(404);
		expect((await reportEvents(job.id, job.token, { events: [] })).status).toBe(404);
		expect((await callMcp(job.id, job.token, 'tools/list', {})).status).toBe(404);
	});

	it('relays reported events, keeps the text in the chat and ends the turn', async () => {
		const { session, job } = await startClaimedTurn('Najděte kolo');

		const reported = await reportEvents(job.id, job.token, {
			events: [
				{ type: CHAT_STREAM_EVENT.tool, name: 'web_search', query: 'dětské kolo' },
				{ type: CHAT_STREAM_EVENT.text, text: 'Našel jsem kolo.' },
			],
		});
		const finished = await reportEvents(job.id, job.token, { status: 'done' });

		expect(await reported.json()).toEqual({ cancelled: false });
		expect(await finished.json()).toEqual({ cancelled: false });
		const stored = await readJob(job.id);
		expect(stored).toMatchObject({ status: CHAT_RUNNER_JOB_STATUS.done, tokenHash: null });
		expect(stored.finishedAt).not.toBeNull();
		const messages = await storedMessages(session.id);
		expect(messages.map((message) => [message.role, message.content])).toEqual([
			[CHAT_ROLE.user, [{ type: CHAT_BLOCK.text, text: 'Najděte kolo' }]],
			[CHAT_ROLE.assistant, [{ type: CHAT_BLOCK.text, text: 'Našel jsem kolo.' }]],
		]);
		expect(
			await streamedEvents(
				await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`),
			),
		).toEqual([
			{ type: CHAT_STREAM_EVENT.tool, name: 'web_search', query: 'dětské kolo' },
			{ type: CHAT_STREAM_EVENT.text, text: 'Našel jsem kolo.' },
			{ type: CHAT_STREAM_EVENT.done },
		]);
		expect(
			await streamedEvents(
				await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=1`),
			),
		).toEqual([
			{ type: CHAT_STREAM_EVENT.text, text: 'Našel jsem kolo.' },
			{ type: CHAT_STREAM_EVENT.done },
		]);
		expect((await reportEvents(job.id, job.token, { events: [] })).status).toBe(401);
	});

	it('ignores a retried report the app already applied', async () => {
		const { session, job } = await startClaimedTurn();
		const report = {
			sequence: lastReportSequence + 1,
			events: [{ type: CHAT_STREAM_EVENT.text, text: 'Našel jsem kolo.' }],
		};

		const first = await reportEvents(job.id, job.token, report);
		const retried = await reportEvents(job.id, job.token, report);

		expect(await first.json()).toEqual({ cancelled: false });
		expect(await retried.json()).toEqual({ cancelled: false });
		expect((await readJob(job.id)).events).toEqual(report.events);
		expect(
			(await storedMessages(session.id)).filter(
				(message) => message.role === CHAT_ROLE.assistant,
			),
		).toHaveLength(1);
	});

	it('accepts a job token only for its own job while that job runs', async () => {
		const { job } = await startClaimedTurn();
		const { job: otherJob } = await startClaimedTurn();

		expect((await callMcp(job.id, 'wrong-token', 'tools/list', {})).status).toBe(401);
		expect((await callMcp(job.id, null, 'tools/list', {})).status).toBe(401);
		expect((await callMcp(job.id, 'runner-secret', 'tools/list', {})).status).toBe(401);
		expect((await reportEvents(job.id, 'runner-secret', { events: [] })).status).toBe(401);
		expect((await callMcp(otherJob.id, job.token, 'tools/list', {})).status).toBe(401);
		expect((await reportEvents(otherJob.id, job.token, { events: [] })).status).toBe(401);
		expect((await callMcp(job.id, job.token, 'tools/list', {})).status).toBe(200);

		await reportEvents(job.id, job.token, { status: 'done' });

		expect((await callMcp(job.id, job.token, 'tools/list', {})).status).toBe(401);
	});

	it('ends a failed job with the provider error', async () => {
		const { session, job } = await startClaimedTurn();

		await reportEvents(job.id, job.token, { status: 'failed' });

		expect(await readJob(job.id)).toMatchObject({
			status: CHAT_RUNNER_JOB_STATUS.failed,
			error: CHAT_TURN_ERROR.providerFailed,
		});
		expect(
			await streamedEvents(
				await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`),
			),
		).toEqual([{ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.providerFailed }]);
	});

	it('refuses reports without the job token or with events the runner does not send', async () => {
		const { job } = await startClaimedTurn();

		expect((await reportEvents(job.id, 'wrong-token', { events: [] })).status).toBe(401);
		const forged = await reportEvents(job.id, job.token, {
			events: [{ type: CHAT_STREAM_EVENT.proposal, proposalId: 'p1', applied: true }],
		});
		expect(forged.status).toBe(400);
		const unnumbered = await handleChatRunnerEvents({
			request: runnerRequest(`/chat-runner/jobs/${job.id}/events`, `Bearer ${job.token}`, {
				events: [{ type: CHAT_STREAM_EVENT.text, text: 'Bez čísla' }],
			}),
			url: new URL(`${ORIGIN}/chat-runner/jobs/${job.id}/events`),
			params: { jobId: job.id },
		});
		expect(unnumbered.status).toBe(400);
		expect((await readJob(job.id)).events).toEqual([]);
	});

	it('cancels a still unclaimed job once the browser drops the turn’s first response', async () => {
		const { session } = await newChat();
		const response = await postTurn(session.id, { kind: CHAT_TURN_KIND.message, text: 'Ahoj' });

		await response.body?.cancel();

		await vi.waitFor(async () => {
			const [cancelled] = await sessionJobs(session.id);
			expect(cancelled?.status).toBe(CHAT_RUNNER_JOB_STATUS.cancelled);
		});
		expect((await claim()).status).toBe(204);
	});

	it('tells the runner to stop once the browser drops a continuation of the turn', async () => {
		const { session, job } = await startClaimedTurn();
		const continuation = await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`);

		await continuation.body?.cancel();

		await vi.waitFor(async () => {
			expect((await readJob(job.id)).status).toBe(CHAT_RUNNER_JOB_STATUS.cancelled);
		});
		const report = await reportEvents(job.id, job.token, {
			events: [{ type: CHAT_STREAM_EVENT.text, text: 'Pozdě' }],
		});
		expect(await report.json()).toEqual({ cancelled: true });
		expect((await readJob(job.id)).events).toEqual([]);
	});

	it('keeps a turn running when a relay window ends without the browser leaving', async () => {
		const { session, job } = await startClaimedTurn();

		const events = await streamedEvents(
			await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`),
		);

		expect(events.map((event) => event.type)).toEqual([CHAT_STREAM_EVENT.continue]);
		expect((await readJob(job.id)).status).toBe(CHAT_RUNNER_JOB_STATUS.running);
	});

	it('answers a report for a job the user already cancelled with the order to stop', async () => {
		const { job } = await startClaimedTurn();
		await getDb()
			.update(chatRunnerJob)
			.set({ status: CHAT_RUNNER_JOB_STATUS.cancelled })
			.where(eq(chatRunnerJob.id, job.id));

		const report = await reportEvents(job.id, job.token, {
			events: [{ type: CHAT_STREAM_EVENT.text, text: 'Pozdě' }],
		});
		expect(await report.json()).toEqual({ cancelled: true });
		expect((await readJob(job.id)).events).toEqual([]);
	});

	it('offers the chat tools over MCP and makes each change call a proposal of the chat', async () => {
		const { wishlist, session, job } = await startClaimedTurn();

		const listed = (await (await callMcp(job.id, job.token, 'tools/list', {})).json()) as {
			result: { tools: { name: string }[] };
		};
		const toolNames = listed.result.tools.map((tool) => tool.name);
		expect(toolNames).toEqual(expect.arrayContaining(['readWishlistGifts', 'createGift']));
		expect(toolNames).not.toContain('listWishlists');

		const called = (await (
			await callMcp(job.id, job.token, 'tools/call', {
				name: 'createGift',
				arguments: { wishlistId: wishlist.id, name: 'Kolo' },
			})
		).json()) as { result: { content: { type: string; text: string }[]; isError: boolean } };

		expect(called.result.isError).toBe(false);
		const toolOutput = JSON.parse(called.result.content[0]?.text ?? '{}') as {
			proposalId: string;
			applied: boolean;
		};
		expect(toolOutput.applied).toBe(false);
		const [proposal] = await getDb()
			.select()
			.from(changeProposal)
			.where(eq(changeProposal.id, toolOutput.proposalId));
		expect(proposal).toMatchObject({
			wishlistId: wishlist.id,
			submitterUserId: MANAGER_ID,
			channel: OPERATION_CHANNEL.chatbot,
		});
		const assistantMessages = (await storedMessages(session.id)).filter(
			(message) => message.role === CHAT_ROLE.assistant,
		);
		expect(assistantMessages).toHaveLength(1);
		expect(assistantMessages[0]?.proposalId).toBe(toolOutput.proposalId);
		expect(assistantMessages[0]?.content.map((block) => block.type)).toEqual([
			CHAT_BLOCK.toolCall,
			CHAT_BLOCK.toolResult,
		]);
		expect((await readJob(job.id)).events).toEqual([
			{ type: CHAT_STREAM_EVENT.tool, name: 'createGift', query: null },
			{ type: CHAT_STREAM_EVENT.proposal, proposalId: toolOutput.proposalId, applied: false },
		]);
	});

	it('applies an MCP change at once when the chat fast-forwards', async () => {
		const { wishlist, session, job } = await startClaimedTurn();
		await setChatFastForward(session.id, true);

		const called = (await (
			await callMcp(job.id, job.token, 'tools/call', {
				name: 'createGift',
				arguments: { wishlistId: wishlist.id, name: 'Kolo' },
			})
		).json()) as { result: { content: { type: string; text: string }[]; isError: boolean } };

		const toolOutput = JSON.parse(called.result.content[0]?.text ?? '{}') as {
			proposalId: string;
			applied: boolean;
		};
		expect(toolOutput.applied).toBe(true);
		expect((await readJob(job.id)).events).toContainEqual({
			type: CHAT_STREAM_EVENT.proposal,
			proposalId: toolOutput.proposalId,
			applied: true,
		});
	});

	it('refuses MCP calls for a job that no longer runs', async () => {
		const { job } = await startClaimedTurn();
		await getDb()
			.update(chatRunnerJob)
			.set({ status: CHAT_RUNNER_JOB_STATUS.cancelled })
			.where(eq(chatRunnerJob.id, job.id));

		const response = await callMcp(job.id, job.token, 'tools/list', {});

		expect(response.status).toBe(409);
	});

	it('continues a turn only for its own chat’s user', async () => {
		const { session, job } = await startClaimedTurn();
		const url = `/chat/${session.id}/turns/${job.id}?cursor=0`;
		const { session: otherUsersChat } = await newChat(RECIPIENT_ID);
		const { session: otherOwnChat } = await newChat();

		expect((await continueTurn(url, null)).status).toBe(401);
		await expect(
			continueTurn(`/chat/${otherUsersChat.id}/turns/${job.id}?cursor=0`),
		).rejects.toMatchObject({ status: 404 });
		await expect(continueTurn(url, { id: RECIPIENT_ID })).rejects.toMatchObject({
			status: 404,
		});
		expect(
			(await continueTurn(`/chat/${otherOwnChat.id}/turns/${job.id}?cursor=0`)).status,
		).toBe(404);
	});

	it('replays a continuation from the start when its cursor is not a count', async () => {
		const { session, job } = await startClaimedTurn();
		await reportEvents(job.id, job.token, {
			events: [{ type: CHAT_STREAM_EVENT.text, text: 'Hotovo.' }],
			status: 'done',
		});

		for (const cursor of ['abc', '-3', '']) {
			expect(
				await streamedEvents(
					await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=${cursor}`),
				),
			).toEqual([
				{ type: CHAT_STREAM_EVENT.text, text: 'Hotovo.' },
				{ type: CHAT_STREAM_EVENT.done },
			]);
		}
	});

	it('fails a job nobody claimed in time as the runner being offline', async () => {
		const { session } = await newChat();
		const job = await createJobForChat(
			session.id,
			new Date(Date.now() - CHAT_RUNNER_LIMITS.runnerOfflineMs - 1000),
		);

		const events = await streamedEvents(
			await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`),
		);

		expect(events).toEqual([
			{ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.runnerOffline },
		]);
		expect(await readJob(job.id)).toMatchObject({
			status: CHAT_RUNNER_JOB_STATUS.failed,
			error: CHAT_TURN_ERROR.runnerOffline,
		});
	});

	it('fails a claimed job whose runner went silent', async () => {
		const { session, job } = await startClaimedTurn();
		await getDb()
			.update(chatRunnerJob)
			.set({ updatedAt: new Date(Date.now() - CHAT_RUNNER_LIMITS.heartbeatTimeoutMs - 1000) })
			.where(eq(chatRunnerJob.id, job.id));

		const events = await streamedEvents(
			await continueTurn(`/chat/${session.id}/turns/${job.id}?cursor=0`),
		);

		expect(events).toEqual([
			{ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.providerFailed },
		]);
	});
});
