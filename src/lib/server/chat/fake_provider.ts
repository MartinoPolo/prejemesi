import * as v from 'valibot';
import {
	CHAT_BLOCK,
	CHAT_MODEL_EVENT,
	CHAT_ROLE,
	CHAT_STOP_REASON,
	type ChatContentBlock,
	type ChatModelEvent,
	type ChatModelMessage,
	type ChatModelProvider,
	type ChatModelRequest,
} from './chat_model.js';
import { readChatContext, type ChatContext } from './chat_prompt.js';

/**
 * A scripted assistant for tests, the demo and development without a model key. It answers a
 * few intents by keyword, through the same tools and proposals as the real model: a first
 * response reads the gifts when the intent needs them, the next one requests the change, and the
 * last one reports the result.
 */
const FAKE_CHAT_INTENT = {
	add: 'add',
	enrich: 'enrich',
	remove: 'remove',
	reorder: 'reorder',
	chat: 'chat',
} as const;

type FakeChatIntent = (typeof FAKE_CHAT_INTENT)[keyof typeof FAKE_CHAT_INTENT];

const INTENT_KEYWORDS: readonly [FakeChatIntent, RegExp][] = [
	[FAKE_CHAT_INTENT.add, /^(?:přidejte|přidej|přidat|add)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.enrich, /^(?:vylepšete|vylepši|vylepšit|enrich)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.remove, /^(?:smažte|smaž|delete)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.reorder, /^(?:seřaďte|seřaď|seřadit|reorder|sort)(?:\s+|$)/iu],
];

/** "Přidejte 3 dárky" asks for that many sample gifts rather than one named "3 dárky". */
const SAMPLE_COUNT = /^(\d+)\s/u;
const BY_PRICE = /cen|price/iu;

export const FAKE_ENRICHMENT_TEXT = 'Hodnocení zákazníků: 4,6 z 5 (ukázka).';
const READ_GIFTS_TOOL = 'readWishlistGifts';

const FAKE_REPLIES = {
	cs: {
		introduction: 'Jsem ukázkový asistent. Umím přidat, vylepšit, smazat a seřadit dárky.',
		missingContext: 'Chybí kontext konverzace.',
		noGifts: 'Na seznamu zatím nejsou žádné dárky.',
		adding: 'Přidávám dárek. ',
		addingSamples: 'Navrhuji několik dárků. ',
		enriching: (name: string) => `Doplňuji hodnocení k dárku ${name}. `,
		enrichment: FAKE_ENRICHMENT_TEXT,
		removing: (name: string) => `Navrhuji smazat dárek ${name}. `,
		failed: 'Změnu se nepodařilo navrhnout.',
		refused: (message: string) => `Tuto změnu nelze provést: ${message}`,
		applied: 'Hotovo, změna je použitá.',
		proposed: 'Změnu jsem navrhl, zkontrolujte ji prosím.',
		newGiftName: 'Nový dárek',
		samples: [
			{ name: 'Sklenice na červené víno, 4 ks', price: 790 },
			{ name: 'Dárková sada čajů', price: 590 },
			{ name: 'Kniha Pokojové rostliny pro každého', price: 399 },
		],
	},
	en: {
		introduction: 'I am a sample assistant. I can add, enrich, delete and reorder gifts.',
		missingContext: 'The conversation context is missing.',
		noGifts: 'There are no gifts on the list yet.',
		adding: 'Adding the gift. ',
		addingSamples: 'Here are a few gift ideas. ',
		enriching: (name: string) => `Adding a rating to ${name}. `,
		enrichment: 'Customer rating: 4.6 out of 5 (sample).',
		removing: (name: string) => `I suggest deleting ${name}. `,
		failed: 'The change could not be proposed.',
		refused: (message: string) => `This change is not possible: ${message}`,
		applied: 'Done, the change is applied.',
		proposed: 'I proposed the change, please review it.',
		newGiftName: 'New gift',
		samples: [
			{ name: 'Red wine glasses, set of 4', price: 790 },
			{ name: 'Tea gift set', price: 590 },
			{ name: 'Houseplants for Everyone (book)', price: 399 },
		],
	},
} as const;

type FakeReplies = (typeof FAKE_REPLIES)[keyof typeof FAKE_REPLIES];

const GiftListResultSchema = v.object({
	result: v.object({
		gifts: v.array(
			v.object({ id: v.string(), name: v.string(), price: v.nullish(v.number()) }),
		),
	}),
});

type ListedGift = v.InferOutput<typeof GiftListResultSchema>['result']['gifts'][number];

const ChangeResultSchema = v.object({
	applied: v.optional(v.boolean()),
	error: v.nullish(v.object({ message: v.string() })),
});

function intentOf(text: string): { intent: FakeChatIntent; rest: string } {
	for (const [intent, keyword] of INTENT_KEYWORDS) {
		const match = keyword.exec(text.trim());
		if (match !== null) {
			return { intent, rest: text.trim().slice(match[0].length).trim() };
		}
	}
	return { intent: FAKE_CHAT_INTENT.chat, rest: text };
}

function lastUserText(messages: readonly ChatModelMessage[]): string {
	for (const message of [...messages].reverse()) {
		const text = message.content.find((block) => block.type === CHAT_BLOCK.text);
		if (message.role === CHAT_ROLE.user && text?.type === CHAT_BLOCK.text) {
			return text.text;
		}
	}
	return '';
}

function toolResults(message: ChatModelMessage | undefined) {
	return (message?.content ?? []).flatMap((block) =>
		block.type === CHAT_BLOCK.toolResult ? [block] : [],
	);
}

/** The tool call whose result is `result`, from the response just before it. */
function callOf(
	messages: readonly ChatModelMessage[],
	result: Extract<ChatContentBlock, { type: typeof CHAT_BLOCK.toolResult }>,
) {
	return messages
		.flatMap((message) => message.content)
		.find((block) => block.type === CHAT_BLOCK.toolCall && block.id === result.toolCallId);
}

function parseJson(content: string): unknown {
	try {
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function* say(text: string): Generator<ChatModelEvent> {
	for (const word of text.split(/(?<= )/u)) {
		yield { type: CHAT_MODEL_EVENT.textDelta, text: word };
	}
}

/** One response requesting every call, which the chat turns into one proposal. */
function* callTools(calls: readonly { name: string; input: unknown }[]): Generator<ChatModelEvent> {
	for (const { name, input } of calls) {
		yield { type: CHAT_MODEL_EVENT.toolCall, id: crypto.randomUUID(), name, input };
	}
	yield { type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse };
}

function* callTool(name: string, input: unknown): Generator<ChatModelEvent> {
	yield* callTools([{ name, input }]);
}

function* finish(text: string): Generator<ChatModelEvent> {
	yield* say(text);
	yield { type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn };
}

/** The gift the user named, or the first one. */
function targetGift(gifts: readonly ListedGift[], named: string) {
	const lowerNamed = named.toLowerCase();
	return (
		gifts.find((gift) => lowerNamed !== '' && gift.name.toLowerCase().includes(lowerNamed)) ??
		gifts[0]
	);
}

/** Cheapest first and unpriced last; otherwise simply the reverse order. */
function reorderedGiftIds(gifts: readonly ListedGift[], byPrice: boolean): string[] {
	const ordered = byPrice
		? [...gifts].sort(
				(first, second) =>
					(first.price ?? Number.POSITIVE_INFINITY) -
					(second.price ?? Number.POSITIVE_INFINITY),
			)
		: [...gifts].reverse();
	return ordered.map((gift) => gift.id);
}

function* addGifts(
	named: string,
	context: ChatContext,
	replies: FakeReplies,
): Generator<ChatModelEvent> {
	const sampleCount = SAMPLE_COUNT.exec(named);
	if (sampleCount === null) {
		yield* say(replies.adding);
		yield* callTool('createGift', {
			wishlistId: context.wishlistId,
			name: named === '' ? replies.newGiftName : named,
		});
		return;
	}
	yield* say(replies.addingSamples);
	yield* callTools(
		replies.samples.slice(0, Math.max(1, Number(sampleCount[1]))).map((sample) => ({
			name: 'createGift',
			input: { wishlistId: context.wishlistId, ...sample },
		})),
	);
}

function* changeFromGifts(
	intent: FakeChatIntent,
	named: string,
	gifts: readonly ListedGift[],
	context: ChatContext,
	replies: FakeReplies,
): Generator<ChatModelEvent> {
	const gift = targetGift(gifts, named);
	if (intent === FAKE_CHAT_INTENT.reorder) {
		yield* callTool('reorderGifts', {
			wishlistId: context.wishlistId,
			orderedGiftIds: reorderedGiftIds(gifts, BY_PRICE.test(named)),
		});
	} else if (gift === undefined) {
		yield* finish(replies.noGifts);
	} else if (intent === FAKE_CHAT_INTENT.enrich) {
		yield* say(replies.enriching(gift.name));
		yield* callTool('appendGiftDescription', { giftId: gift.id, text: replies.enrichment });
	} else {
		yield* say(replies.removing(gift.name));
		yield* callTool('deleteGift', { giftId: gift.id });
	}
}

function changeOutcome(content: string, replies: FakeReplies): string {
	const parsed = v.safeParse(ChangeResultSchema, parseJson(content));
	if (!parsed.success) {
		return replies.failed;
	}
	if (parsed.output.error != null) {
		return replies.refused(parsed.output.error.message);
	}
	return parsed.output.applied === true ? replies.applied : replies.proposed;
}

function* respond(request: ChatModelRequest): Generator<ChatModelEvent> {
	const context = readChatContext(request.system);
	const { messages } = request;
	const { intent, rest } = intentOf(lastUserText(messages));
	const [result] = toolResults(messages.at(-1));
	if (context === null) {
		yield* finish(FAKE_REPLIES.cs.missingContext);
		return;
	}
	const replies = context.locale === 'en' ? FAKE_REPLIES.en : FAKE_REPLIES.cs;
	if (result === undefined) {
		if (intent === FAKE_CHAT_INTENT.chat) {
			yield* finish(replies.introduction);
		} else if (intent === FAKE_CHAT_INTENT.add) {
			yield* addGifts(rest, context, replies);
		} else {
			yield* callTool(READ_GIFTS_TOOL, { wishlistShortId: context.wishlistShortId });
		}
		return;
	}
	const call = callOf(messages, result);
	const gifts = v.safeParse(GiftListResultSchema, parseJson(result.content));
	if (call?.type === CHAT_BLOCK.toolCall && call.name === READ_GIFTS_TOOL && gifts.success) {
		yield* changeFromGifts(intent, rest, gifts.output.result.gifts, context, replies);
		return;
	}
	yield* finish(changeOutcome(result.content, replies));
}

export function createFakeProvider(): ChatModelProvider {
	return {
		async *stream(request, signal) {
			for (const event of respond(request)) {
				signal.throwIfAborted();
				yield event;
			}
		},
	};
}
