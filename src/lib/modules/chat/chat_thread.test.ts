import { describe, expect, it } from 'vitest';
import {
	CHAT_ITEM,
	CHAT_PART,
	CHAT_TOOL_KIND,
	chatThreadItems,
	chatToolKind,
	isChatTurnUnfinished,
	latestChatProposalId,
	startLiveChatTurn,
	withStreamEvent,
} from './chat_thread.js';
import {
	CHAT_ROLE,
	CHAT_STREAM_EVENT,
	CHAT_TURN_ERROR,
	type ChatMessageView,
	type ChatStreamEvent,
} from './types.js';

function message(overrides: Partial<ChatMessageView> & Pick<ChatMessageView, 'id'>) {
	return {
		role: CHAT_ROLE.assistant,
		text: '',
		toolNames: [],
		proposalId: null,
		createdAt: new Date('2026-10-20T10:00:00Z'),
		...overrides,
	} satisfies ChatMessageView;
}

describe('chatToolKind', () => {
	it('tells web search, reads and changes apart', () => {
		expect(chatToolKind('web_search')).toBe(CHAT_TOOL_KIND.search);
		expect(chatToolKind('readWishlistGifts')).toBe(CHAT_TOOL_KIND.read);
		expect(chatToolKind('updateGift')).toBe(CHAT_TOOL_KIND.change);
		expect(chatToolKind('reorderGifts')).toBe(CHAT_TOOL_KIND.change);
	});
});

describe('chatThreadItems', () => {
	it('joins the steps of one answer into one assistant item', () => {
		const items = chatThreadItems([
			message({ id: 'u1', role: CHAT_ROLE.user, text: 'Vylepšete sluchátka' }),
			message({ id: 'a1', toolNames: ['readWishlistGifts'] }),
			message({
				id: 'a2',
				text: 'Doplňuji hodnocení.',
				toolNames: ['appendGiftDescription', 'updateGift'],
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
							{ kind: CHAT_TOOL_KIND.read, query: null },
							{ kind: CHAT_TOOL_KIND.change, query: null },
						],
					},
					{ type: CHAT_PART.text, text: 'Doplňuji hodnocení.' },
					{ type: CHAT_PART.proposal, proposalId: 'p1' },
					{ type: CHAT_PART.text, text: 'Změnu jsem navrhl.' },
				],
			},
		]);
	});
});

describe('isChatTurnUnfinished', () => {
	it('is unfinished after the user message or a step with tools, as the server allows a retry', () => {
		const asked = message({ id: 'u1', role: CHAT_ROLE.user, text: 'Ahoj' });
		const step = message({ id: 'a1', toolNames: ['readWishlistGifts'] });
		const answer = message({ id: 'a2', text: 'Hotovo.' });

		expect(isChatTurnUnfinished([])).toBe(false);
		expect(isChatTurnUnfinished([asked])).toBe(true);
		expect(isChatTurnUnfinished([asked, step])).toBe(true);
		expect(isChatTurnUnfinished([asked, step, answer])).toBe(false);
	});
});

describe('latestChatProposalId', () => {
	it('returns the newest proposal', () => {
		expect(
			latestChatProposalId([
				message({ id: 'a1', proposalId: 'p1' }),
				message({ id: 'a2', proposalId: 'p2' }),
				message({ id: 'a3' }),
			]),
		).toBe('p2');
		expect(latestChatProposalId([message({ id: 'a1' })])).toBeNull();
	});
});

describe('withStreamEvent', () => {
	it('joins streamed text and tool lines and marks a proposed turn', () => {
		const events: ChatStreamEvent[] = [
			{ type: CHAT_STREAM_EVENT.tool, name: 'web_search', query: 'Sony WH-1000XM5' },
			{ type: CHAT_STREAM_EVENT.tool, name: 'readWishlistGifts', query: null },
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
						{ kind: CHAT_TOOL_KIND.search, query: 'Sony WH-1000XM5' },
						{ kind: CHAT_TOOL_KIND.read, query: null },
					],
				},
				{ type: CHAT_PART.text, text: 'Doplňuji hodnocení.' },
				{ type: CHAT_PART.proposal, proposalId: 'p1' },
			],
		});
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
