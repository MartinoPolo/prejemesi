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

function systemPrompt(locale: string) {
	return chatSystemPrompt({
		wishlistId: 'wishlist-1',
		wishlistShortId: 'short-1',
		wishlistTitle: 'Vánoce',
		userName: 'Martin',
		locale,
	});
}

const GIFTS_RESULT = JSON.stringify({
	result: {
		role: 'manager',
		gifts: [
			{ id: 'gift-1', name: 'Kolo' },
			{ id: 'gift-2', name: 'Sluchátka Sony' },
		],
	},
});

const PRICED_GIFTS_RESULT = JSON.stringify({
	result: {
		role: 'manager',
		gifts: [
			{ id: 'gift-1', name: 'Kolo', price: 9000 },
			{ id: 'gift-2', name: 'Pohled', price: null },
			{ id: 'gift-3', name: 'Ponožky', price: 150 },
		],
	},
});

async function respond(messages: ChatModelMessage[], locale = 'cs'): Promise<ChatModelEvent[]> {
	const events: ChatModelEvent[] = [];
	const stream = createFakeProvider().stream(
		{ system: systemPrompt(locale), messages, tools: [], maxOutputTokens: 100 },
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

function textOf(events: ChatModelEvent[]): string {
	return events
		.flatMap((event) => (event.type === CHAT_MODEL_EVENT.textDelta ? [event.text] : []))
		.join('');
}

/** The conversation after the fake read the gifts for `request`. */
async function afterReadingGifts(
	request: string,
	giftsResult = GIFTS_RESULT,
	locale = 'cs',
): Promise<ChatModelEvent[]> {
	const read = toolCallOf(await respond([userText(request)], locale));
	if (read?.type !== CHAT_MODEL_EVENT.toolCall) {
		throw new Error('The fake did not read the gifts');
	}
	return respond(
		[
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
						content: giftsResult,
						isError: false,
					},
				],
			},
		],
		locale,
	);
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

	it('adds the requested number of sample gifts in one response, so they form one proposal', async () => {
		const events = await respond([userText('Přidejte 3 dárky')]);
		const calls = events.filter((event) => event.type === CHAT_MODEL_EVENT.toolCall);

		expect(calls).toHaveLength(3);
		expect(calls.every((call) => call.name === 'createGift')).toBe(true);
		expect(calls[0]).toMatchObject({
			input: { wishlistId: 'wishlist-1', name: 'Sklenice na červené víno, 4 ks', price: 790 },
		});
		expect(events.at(-1)).toEqual({
			type: CHAT_MODEL_EVENT.stop,
			reason: CHAT_STOP_REASON.toolUse,
		});
	});

	it('sorts by price on request, cheapest first and unpriced gifts last', async () => {
		expect(
			toolCallOf(await afterReadingGifts('Seřaďte podle ceny', PRICED_GIFTS_RESULT)),
		).toMatchObject({
			name: 'reorderGifts',
			input: { orderedGiftIds: ['gift-3', 'gift-1', 'gift-2'] },
		});
	});

	it('answers in English in an English chat', async () => {
		expect(textOf(await respond([userText('Hello')], 'en'))).toBe(
			'I am a sample assistant. I can add, enrich, delete and reorder gifts.',
		);
		const enriched = await afterReadingGifts('Enrich Sony', GIFTS_RESULT, 'en');
		expect(textOf(enriched)).toBe('Adding a rating to Sluchátka Sony. ');
		expect(toolCallOf(enriched)).toMatchObject({
			input: { giftId: 'gift-2', text: 'Customer rating: 4.6 out of 5 (sample).' },
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
