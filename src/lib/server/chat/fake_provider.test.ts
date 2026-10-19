import { describe, expect, it } from 'vitest';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_ROLE,
	CHAT_STOP_REASON,
	type ChatModelEvent,
	type ChatModelMessage,
} from './chat_model.js';
import { chatSystemPrompt } from './chat_prompt.js';
import { FAKE_ENRICHMENT_TEXT, createFakeProvider } from './fake_provider.js';

const SYSTEM = chatSystemPrompt({
	wishlistId: 'wishlist-1',
	wishlistShortId: 'short-1',
	wishlistTitle: 'Vánoce',
	userName: 'Martin',
	locale: 'cs',
});

const GIFTS_RESULT = JSON.stringify({
	result: {
		role: 'manager',
		gifts: [
			{ id: 'gift-1', name: 'Kolo' },
			{ id: 'gift-2', name: 'Sluchátka Sony' },
		],
	},
});

async function respond(messages: ChatModelMessage[]): Promise<ChatModelEvent[]> {
	const events: ChatModelEvent[] = [];
	const stream = createFakeProvider().stream(
		{ system: SYSTEM, messages, tools: [], maxOutputTokens: 100 },
		new AbortController().signal,
	);
	for await (const event of stream) {
		events.push(event);
	}
	return events;
}

function userText(text: string): ChatModelMessage {
	return { role: CHAT_ROLE.user, content: [{ type: CHAT_BLOCK.text, text }] };
}

function toolCallOf(events: ChatModelEvent[]) {
	return events.find((event) => event.type === CHAT_MODEL_EVENT.toolCall);
}

/** The conversation after the fake read the gifts for `request`. */
async function afterReadingGifts(request: string): Promise<ChatModelEvent[]> {
	const read = toolCallOf(await respond([userText(request)]));
	if (read?.type !== CHAT_MODEL_EVENT.toolCall) {
		throw new Error('The fake did not read the gifts');
	}
	return respond([
		userText(request),
		{
			role: CHAT_ROLE.assistant,
			content: [
				{ type: CHAT_BLOCK.toolCall, id: read.id, name: read.name, input: read.input },
			],
		},
		{
			role: CHAT_ROLE.user,
			content: [
				{
					type: CHAT_BLOCK.toolResult,
					toolCallId: read.id,
					content: GIFTS_RESULT,
					isError: false,
				},
			],
		},
	]);
}

describe('the fake chat provider', () => {
	it('adds a gift named after the request on the chat’s wishlist', async () => {
		const events = await respond([userText('Přidejte Lego Technic')]);

		expect(toolCallOf(events)).toMatchObject({
			name: 'createGift',
			input: { wishlistId: 'wishlist-1', name: 'Lego Technic' },
		});
		expect(events.at(-1)).toEqual({
			type: CHAT_MODEL_EVENT.stop,
			reason: CHAT_STOP_REASON.toolUse,
		});
	});

	it('reads the gifts first, then enriches the one the user named', async () => {
		expect(toolCallOf(await respond([userText('Vylepšete sluchátka')]))).toMatchObject({
			name: 'readWishlistGifts',
			input: { wishlistShortId: 'short-1' },
		});
		expect(toolCallOf(await afterReadingGifts('Vylepšete sluchátka'))).toMatchObject({
			name: 'appendGiftDescription',
			input: { giftId: 'gift-2', text: FAKE_ENRICHMENT_TEXT },
		});
	});

	it('deletes the named gift and reverses the order on request', async () => {
		expect(toolCallOf(await afterReadingGifts('Smažte kolo'))).toMatchObject({
			name: 'deleteGift',
			input: { giftId: 'gift-1' },
		});
		expect(toolCallOf(await afterReadingGifts('Seřaďte dárky'))).toMatchObject({
			name: 'reorderGifts',
			input: { wishlistId: 'wishlist-1', orderedGiftIds: ['gift-2', 'gift-1'] },
		});
	});

	it('relays a change’s error message as the tool gave it', async () => {
		const events = await respond([
			userText('Přidejte kolo'),
			{
				role: CHAT_ROLE.assistant,
				content: [
					{ type: CHAT_BLOCK.toolCall, id: 'call-1', name: 'createGift', input: {} },
				],
			},
			{
				role: CHAT_ROLE.user,
				content: [
					{
						type: CHAT_BLOCK.toolResult,
						toolCallId: 'call-1',
						content: JSON.stringify({
							error: { code: 'X', message: 'Seznam je archivovaný.' },
						}),
						isError: true,
					},
				],
			},
		]);
		const text = events
			.flatMap((event) => (event.type === CHAT_MODEL_EVENT.textDelta ? [event.text] : []))
			.join('');

		expect(text).toBe('Tuto změnu nelze provést: Seznam je archivovaný.');
		expect(events.at(-1)).toEqual({
			type: CHAT_MODEL_EVENT.stop,
			reason: CHAT_STOP_REASON.endTurn,
		});
	});
});
