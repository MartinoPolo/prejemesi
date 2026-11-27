import { describe, expect, it } from 'vitest';
import {
	CHAT_ITEM,
	CHAT_PART,
	CHAT_PROPOSAL_STATUS,
	CHAT_TOOL_KIND,
	chatThreadItems,
	chatToolKind,
	chatToolLineStatus,
	continuedAnswerParts,
	decisionBarProposalId,
	isChatTurnUnfinished,
	startLiveChatTurn,
	withStreamEvent,
	type ChatPart,
	type ChatProposalStatus,
	type ChatToolCallState,
} from './chat_thread.js';
import {
	CHAT_ROLE,
	CHAT_STREAM_EVENT,
	CHAT_TOOL_STATUS,
	CHAT_TOOL_SUMMARY,
	CHAT_TURN_ERROR,
	type ChatMessageView,
	type ChatStreamEvent,
	type ChatToolView,
} from './types.js';

function message(
	overrides: Partial<ChatMessageView> & Pick<ChatMessageView, 'id'>,
): ChatMessageView {
	return {
		role: CHAT_ROLE.assistant,
		text: '',
		tools: [],
		proposalId: null,
		createdAt: new Date('2026-10-20T10:00:00Z'),
		...overrides,
	};
}

function tool(id: string, name: string, overrides: Partial<ChatToolView> = {}): ChatToolView {
	return {
		id,
		name,
		query: null,
		status: CHAT_TOOL_STATUS.ok,
		error: null,
		durationMs: null,
		summary: null,
		...overrides,
	};
}

/** A streamed tool call before its outcome arrives. */
function runningCall(id: string, name: string, query: string | null): ChatToolCallState {
	return {
		id,
		name,
		query,
		status: CHAT_TOOL_STATUS.running,
		error: null,
		durationMs: null,
		summary: null,
	};
}

describe('chatToolKind', () => {
	it('tells web search, page reads, reads and changes apart', () => {
		expect(chatToolKind('web_search')).toBe(CHAT_TOOL_KIND.search);
		expect(chatToolKind('web_fetch')).toBe(CHAT_TOOL_KIND.fetch);
		expect(chatToolKind('browse_page')).toBe(CHAT_TOOL_KIND.fetch);
		expect(chatToolKind('readWishlistGifts')).toBe(CHAT_TOOL_KIND.read);
		expect(chatToolKind('updateGift')).toBe(CHAT_TOOL_KIND.change);
		expect(chatToolKind('reorderGifts')).toBe(CHAT_TOOL_KIND.change);
	});
});

describe('chatThreadItems', () => {
	it('joins the steps of one answer into one assistant item', () => {
		const items = chatThreadItems([
			message({ id: 'u1', role: CHAT_ROLE.user, text: 'Vylepšete sluchátka' }),
			message({ id: 'a1', tools: [tool('t1', 'readWishlistGifts')] }),
			message({
				id: 'a2',
				text: 'Doplňuji hodnocení.',
				tools: [tool('t2', 'appendGiftDescription'), tool('t3', 'updateGift')],
				proposalId: 'p1',
			}),
			message({ id: 'a3', text: 'Změnu jsem navrhl.' }),
		]);

		expect(items).toEqual([
			{ type: CHAT_ITEM.user, id: 'u1', text: 'Vylepšete sluchátka' },
			{
				type: CHAT_ITEM.assistant,
				id: 'a1',
				parts: [
					{
						type: CHAT_PART.tools,
						tools: [
							{
								kind: CHAT_TOOL_KIND.read,
								query: null,
								calls: [tool('t1', 'readWishlistGifts')],
							},
							{
								kind: CHAT_TOOL_KIND.change,
								query: null,
								calls: [
									tool('t2', 'appendGiftDescription'),
									tool('t3', 'updateGift'),
								],
							},
						],
					},
					{ type: CHAT_PART.text, text: 'Doplňuji hodnocení.' },
					{ type: CHAT_PART.proposal, proposalId: 'p1' },
					{ type: CHAT_PART.text, text: 'Změnu jsem navrhl.' },
				],
			},
		]);
	});

	it('keeps each stored tool call with its query and outcome after a reload', () => {
		const failedPage = tool('t1', 'browse_page', {
			query: 'https://mycky.heureka.cz/',
			status: CHAT_TOOL_STATUS.error,
			error: { code: 'BROWSER_LIMIT_REACHED', message: 'The browser has reached its limit.' },
			durationMs: 1200,
		});
		const search = tool('t2', 'web_search', {
			query: 'myčka Bosch',
			summary: { kind: CHAT_TOOL_SUMMARY.searchResults, count: 8 },
		});

		const [item] = chatThreadItems([message({ id: 'a1', tools: [failedPage, search] })]);

		expect(item).toEqual({
			type: CHAT_ITEM.assistant,
			id: 'a1',
			parts: [
				{
					type: CHAT_PART.tools,
					tools: [
						{
							kind: CHAT_TOOL_KIND.fetch,
							query: 'https://mycky.heureka.cz/',
							calls: [failedPage],
						},
						{ kind: CHAT_TOOL_KIND.search, query: 'myčka Bosch', calls: [search] },
					],
				},
			],
		});
	});

	it('starts the text of each further step of an answer on a new paragraph', () => {
		const items = chatThreadItems([
			message({ id: 'u1', role: CHAT_ROLE.user, text: 'Najděte kolo' }),
			message({ id: 'a1', text: 'Hledám.' }),
			message({ id: 'a2', text: 'Našel jsem kolo.' }),
		]);

		expect(items.at(-1)).toEqual({
			type: CHAT_ITEM.assistant,
			id: 'a1',
			parts: [{ type: CHAT_PART.text, text: 'Hledám.\n\nNašel jsem kolo.' }],
		});
	});
});

describe('continuedAnswerParts', () => {
	it('continues the stored answer with the rejoined turn, its text as a new paragraph', () => {
		const stored: ChatPart[] = [
			{
				type: CHAT_PART.tools,
				tools: [
					{
						kind: CHAT_TOOL_KIND.search,
						query: 'kolo',
						calls: [tool('t1', 'web_search', { query: 'kolo' })],
					},
				],
			},
			{ type: CHAT_PART.text, text: 'Hledám.' },
		];

		expect(
			continuedAnswerParts(stored, [
				{ type: CHAT_PART.text, text: '\n\nNašel jsem kolo.' },
				{ type: CHAT_PART.proposal, proposalId: 'p1' },
			]),
		).toEqual([
			stored[0],
			{ type: CHAT_PART.text, text: 'Hledám.\n\nNašel jsem kolo.' },
			{ type: CHAT_PART.proposal, proposalId: 'p1' },
		]);
		expect(continuedAnswerParts(stored, [])).toEqual(stored);
	});
});

describe('isChatTurnUnfinished', () => {
	it('is unfinished after the user message or a step with tools, as the server allows a retry', () => {
		const asked = message({ id: 'u1', role: CHAT_ROLE.user, text: 'Ahoj' });
		const step = message({ id: 'a1', tools: [tool('t1', 'readWishlistGifts')] });
		const answer = message({ id: 'a2', text: 'Hotovo.' });

		expect(isChatTurnUnfinished([])).toBe(false);
		expect(isChatTurnUnfinished([asked])).toBe(true);
		expect(isChatTurnUnfinished([asked, step])).toBe(true);
		expect(isChatTurnUnfinished([asked, step, answer])).toBe(false);
	});

	it('is finished after an answer whose only tools were web tools the provider ran', () => {
		const asked = message({ id: 'u1', role: CHAT_ROLE.user, text: 'Najděte kolo' });
		const answer = message({
			id: 'a1',
			text: 'Našel jsem kolo.',
			tools: [tool('t1', 'web_search', { query: 'kolo' })],
		});

		expect(isChatTurnUnfinished([asked, answer])).toBe(false);
	});
});

describe('decisionBarProposalId', () => {
	const messages = [
		message({ id: 'a1', proposalId: 'p1' }),
		message({ id: 'a2', proposalId: 'p2' }),
		message({ id: 'a3', proposalId: 'p3' }),
		message({ id: 'a4' }),
	];

	function statuses(byProposalId: Record<string, ChatProposalStatus>) {
		return (proposalId: string) => byProposalId[proposalId] ?? CHAT_PROPOSAL_STATUS.pending;
	}

	it('returns the newest proposal still pending review', () => {
		expect(
			decisionBarProposalId({ messages, fastForward: false, proposalStatus: statuses({}) }),
		).toBe('p3');
	});

	it('skips newer proposals that were decided or failed to load', () => {
		expect(
			decisionBarProposalId({
				messages,
				fastForward: false,
				proposalStatus: statuses({
					p2: CHAT_PROPOSAL_STATUS.unavailable,
					p3: CHAT_PROPOSAL_STATUS.unavailable,
				}),
			}),
		).toBe('p1');
	});

	it('keeps the slot for the newest proposal while its state is still loading', () => {
		expect(
			decisionBarProposalId({
				messages,
				fastForward: false,
				proposalStatus: statuses({ p3: CHAT_PROPOSAL_STATUS.loading }),
			}),
		).toBe('p3');
	});

	it('returns null when no proposal is pending', () => {
		const nonePending = () => CHAT_PROPOSAL_STATUS.unavailable;
		expect(
			decisionBarProposalId({ messages, fastForward: false, proposalStatus: nonePending }),
		).toBeNull();
		expect(
			decisionBarProposalId({
				messages: [message({ id: 'a1' })],
				fastForward: false,
				proposalStatus: statuses({}),
			}),
		).toBeNull();
	});

	it('returns null while fast-forward applies proposals without review', () => {
		expect(
			decisionBarProposalId({ messages, fastForward: true, proposalStatus: statuses({}) }),
		).toBeNull();
	});
});

describe('withStreamEvent', () => {
	it('joins streamed text and tool lines and marks a proposed turn', () => {
		const events: ChatStreamEvent[] = [
			{
				type: CHAT_STREAM_EVENT.tool,
				id: 's1',
				name: 'web_search',
				query: 'Sony WH-1000XM5',
			},
			{ type: CHAT_STREAM_EVENT.tool, id: 'r1', name: 'readWishlistGifts', query: null },
			{ type: CHAT_STREAM_EVENT.text, text: 'Doplňuji ' },
			{ type: CHAT_STREAM_EVENT.text, text: 'hodnocení.' },
			{ type: CHAT_STREAM_EVENT.proposal, proposalId: 'p1', applied: false },
			{ type: CHAT_STREAM_EVENT.done },
		];

		const turn = events.reduce(withStreamEvent, startLiveChatTurn('Vylepšete sluchátka'));

		expect(turn).toEqual({
			userText: 'Vylepšete sluchátka',
			proposed: true,
			error: null,
			parts: [
				{
					type: CHAT_PART.tools,
					tools: [
						{
							kind: CHAT_TOOL_KIND.search,
							query: 'Sony WH-1000XM5',
							calls: [runningCall('s1', 'web_search', 'Sony WH-1000XM5')],
						},
						{
							kind: CHAT_TOOL_KIND.read,
							query: null,
							calls: [runningCall('r1', 'readWishlistGifts', null)],
						},
					],
				},
				{ type: CHAT_PART.text, text: 'Doplňuji hodnocení.' },
				{ type: CHAT_PART.proposal, proposalId: 'p1' },
			],
		});
	});

	it('marks a running tool line done or failed when its outcome arrives', () => {
		const started = [
			{ type: CHAT_STREAM_EVENT.tool, id: 'f1', name: 'browse_page', query: 'https://a.cz/' },
			{ type: CHAT_STREAM_EVENT.tool, id: 's1', name: 'web_search', query: 'kolo' },
		] satisfies ChatStreamEvent[];
		const running = started.reduce(withStreamEvent, startLiveChatTurn('Najděte kolo'));
		const [runningPart] = running.parts;
		expect(
			runningPart?.type === CHAT_PART.tools ? runningPart.tools.map(chatToolLineStatus) : [],
		).toEqual([CHAT_TOOL_STATUS.running, CHAT_TOOL_STATUS.running]);

		const finished = [
			{
				type: CHAT_STREAM_EVENT.toolResult,
				id: 'f1',
				status: CHAT_TOOL_STATUS.error,
				error: { code: 'BROWSER_LIMIT_REACHED', message: null },
				durationMs: 900,
				summary: null,
			},
			{
				type: CHAT_STREAM_EVENT.toolResult,
				id: 's1',
				status: CHAT_TOOL_STATUS.ok,
				error: null,
				durationMs: 400,
				summary: { kind: CHAT_TOOL_SUMMARY.searchResults, count: 5 },
			},
			// An outcome for a tool the panel never saw is ignored.
			{
				type: CHAT_STREAM_EVENT.toolResult,
				id: 'unknown',
				status: CHAT_TOOL_STATUS.ok,
				error: null,
				durationMs: null,
				summary: null,
			},
		] satisfies ChatStreamEvent[];
		const turn = finished.reduce(withStreamEvent, running);

		const [part] = turn.parts;
		expect(part?.type === CHAT_PART.tools ? part.tools : []).toEqual([
			{
				kind: CHAT_TOOL_KIND.fetch,
				query: 'https://a.cz/',
				calls: [
					{
						...runningCall('f1', 'browse_page', 'https://a.cz/'),
						status: CHAT_TOOL_STATUS.error,
						error: { code: 'BROWSER_LIMIT_REACHED', message: null },
						durationMs: 900,
					},
				],
			},
			{
				kind: CHAT_TOOL_KIND.search,
				query: 'kolo',
				calls: [
					{
						...runningCall('s1', 'web_search', 'kolo'),
						status: CHAT_TOOL_STATUS.ok,
						durationMs: 400,
						summary: { kind: CHAT_TOOL_SUMMARY.searchResults, count: 5 },
					},
				],
			},
		]);
	});

	it('shows a tool event without an id, from a server that reports no outcomes, as done', () => {
		const turn = withStreamEvent(startLiveChatTurn(null), {
			type: CHAT_STREAM_EVENT.tool,
			name: 'web_fetch',
			query: 'https://a.cz/',
		});

		const [part] = turn.parts;
		expect(part?.type === CHAT_PART.tools ? part.tools.map(chatToolLineStatus) : []).toEqual([
			CHAT_TOOL_STATUS.ok,
		]);
	});

	it('reads repeated calls of one kind as one line that fails when any call failed', () => {
		const events = [
			{ type: CHAT_STREAM_EVENT.tool, id: 'r1', name: 'readWishlistGifts', query: null },
			{ type: CHAT_STREAM_EVENT.tool, id: 'r2', name: 'readGift', query: null },
			{
				type: CHAT_STREAM_EVENT.toolResult,
				id: 'r2',
				status: CHAT_TOOL_STATUS.error,
				error: { code: 'NOT_FOUND', message: 'Dárek nebyl nalezen.' },
				durationMs: 20,
				summary: null,
			},
		] satisfies ChatStreamEvent[];
		const turn = events.reduce(withStreamEvent, startLiveChatTurn(null));

		const [part] = turn.parts;
		const lines = part?.type === CHAT_PART.tools ? part.tools : [];
		expect(lines).toHaveLength(1);
		expect(lines[0]?.calls.map((call) => call.id)).toEqual(['r1', 'r2']);
		expect(lines.map(chatToolLineStatus)).toEqual([CHAT_TOOL_STATUS.error]);
	});

	it('keeps what streamed when the turn fails', () => {
		const turn = withStreamEvent(
			withStreamEvent(startLiveChatTurn(null), {
				type: CHAT_STREAM_EVENT.text,
				text: 'Hledám',
			}),
			{ type: CHAT_STREAM_EVENT.error, error: CHAT_TURN_ERROR.providerFailed },
		);

		expect(turn.error).toBe(CHAT_TURN_ERROR.providerFailed);
		expect(turn.parts).toEqual([{ type: CHAT_PART.text, text: 'Hledám' }]);
	});
});
