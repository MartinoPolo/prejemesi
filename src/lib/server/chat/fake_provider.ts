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
	[FAKE_CHAT_INTENT.add, /^(?:přidejte|přidej|add)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.enrich, /^(?:vylepšete|vylepši|enrich)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.remove, /^(?:smažte|smaž|delete)(?:\s+|$)/iu],
	[FAKE_CHAT_INTENT.reorder, /^(?:seřaďte|seřaď|reorder)(?:\s+|$)/iu],
];

export const FAKE_ENRICHMENT_TEXT = 'Hodnocení zákazníků: 4,6 z 5 (ukázka).';
const FAKE_GIFT_NAME = 'Nový dárek';
const READ_GIFTS_TOOL = 'readWishlistGifts';

const GiftListResultSchema = v.object({
	result: v.object({ gifts: v.array(v.object({ id: v.string(), name: v.string() })) }),
});

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

function* callTool(name: string, input: unknown): Generator<ChatModelEvent> {
	yield { type: CHAT_MODEL_EVENT.toolCall, id: crypto.randomUUID(), name, input };
	yield { type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.toolUse };
}

function* finish(text: string): Generator<ChatModelEvent> {
	yield* say(text);
	yield { type: CHAT_MODEL_EVENT.stop, reason: CHAT_STOP_REASON.endTurn };
}

/** The gift the user named, or the first one. */
function targetGift(gifts: readonly { id: string; name: string }[], named: string) {
	const lowerNamed = named.toLowerCase();
	return (
		gifts.find((gift) => lowerNamed !== '' && gift.name.toLowerCase().includes(lowerNamed)) ??
		gifts[0]
	);
}

function* changeFromGifts(
	intent: FakeChatIntent,
	named: string,
	gifts: readonly { id: string; name: string }[],
	context: ChatContext,
): Generator<ChatModelEvent> {
	const gift = targetGift(gifts, named);
	if (intent === FAKE_CHAT_INTENT.reorder) {
		yield* callTool('reorderGifts', {
			wishlistId: context.wishlistId,
			orderedGiftIds: gifts.map((candidate) => candidate.id).reverse(),
		});
	} else if (gift === undefined) {
		yield* finish('Na seznamu zatím nejsou žádné dárky.');
	} else if (intent === FAKE_CHAT_INTENT.enrich) {
		yield* say(`Doplňuji hodnocení k dárku ${gift.name}. `);
		yield* callTool('appendGiftDescription', { giftId: gift.id, text: FAKE_ENRICHMENT_TEXT });
	} else {
		yield* say(`Navrhuji smazat dárek ${gift.name}. `);
		yield* callTool('deleteGift', { giftId: gift.id });
	}
}

function changeOutcome(content: string): string {
	const parsed = v.safeParse(ChangeResultSchema, parseJson(content));
	if (!parsed.success) {
		return 'Změnu se nepodařilo navrhnout.';
	}
	if (parsed.output.error != null) {
		return `Tuto změnu nelze provést: ${parsed.output.error.message}`;
	}
	return parsed.output.applied === true
		? 'Hotovo, změna je použitá.'
		: 'Změnu jsem navrhl, zkontrolujte ji prosím.';
}

function* respond(request: ChatModelRequest): Generator<ChatModelEvent> {
	const context = readChatContext(request.system);
	const { messages } = request;
	const { intent, rest } = intentOf(lastUserText(messages));
	const [result] = toolResults(messages.at(-1));
	if (context === null) {
		yield* finish('Chybí kontext konverzace.');
		return;
	}
	if (result === undefined) {
		if (intent === FAKE_CHAT_INTENT.chat) {
			yield* finish('Jsem ukázkový asistent. Umím přidat, vylepšit, smazat a seřadit dárky.');
		} else if (intent === FAKE_CHAT_INTENT.add) {
			yield* say('Přidávám dárek. ');
			yield* callTool('createGift', {
				wishlistId: context.wishlistId,
				name: rest === '' ? FAKE_GIFT_NAME : rest,
			});
		} else {
			yield* callTool(READ_GIFTS_TOOL, { wishlistShortId: context.wishlistShortId });
		}
		return;
	}
	const call = callOf(messages, result);
	const gifts = v.safeParse(GiftListResultSchema, parseJson(result.content));
	if (call?.type === CHAT_BLOCK.toolCall && call.name === READ_GIFTS_TOOL && gifts.success) {
		yield* changeFromGifts(intent, rest, gifts.output.result.gifts, context);
		return;
	}
	yield* finish(changeOutcome(result.content));
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
