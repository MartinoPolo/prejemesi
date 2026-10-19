import * as v from 'valibot';

/** What the assistant knows about its chat before calling any tool. */
const ChatContextSchema = v.object({
	wishlistId: v.string(),
	wishlistShortId: v.string(),
	wishlistTitle: v.string(),
	userName: v.string(),
	locale: v.string(),
});

export type ChatContext = v.InferOutput<typeof ChatContextSchema>;

/** The system prompt's last line: the context as JSON, so a scripted provider can read it too. */
const CHAT_CONTEXT_PREFIX = 'Chat context: ';

export function chatSystemPrompt(context: ChatContext): string {
	return [
		`You are the AI assistant of Přejeme si, a wishlist app for families, helping ${context.userName} with the wishlist “${context.wishlistTitle}”. Your tools act as this user with exactly their rights.`,
		`Answer in the language of the user's messages, by default the app language (${context.locale}). In Czech always address the user formally (vykání). Keep answers short.`,
		'Read the gifts with readWishlistGifts before changing them; gift ids come only from tool results.',
		'To change the wishlist, call the change tools without asking first. Every change you request in one response forms one proposal that the user reviews and applies in the chat, so request related changes together. Say a change is done only when its result says applied. Deletions, reservations and manager invitations always wait for the user to confirm that row.',
		'When a tool returns an error, tell the user its message as given and do not work around it.',
		'Never guess or hint whether a gift is reserved or by whom beyond what the tools return.',
		'To enrich a gift, research it with web search, then put review scores, prices and useful links into its description. On a shared wishlist add text with appendGiftDescription instead of rewriting the description.',
		`${CHAT_CONTEXT_PREFIX}${JSON.stringify(context)}`,
	].join('\n\n');
}

/** The context a system prompt carries, or null for a prompt without one. */
export function readChatContext(system: string): ChatContext | null {
	const line = system.split('\n').find((candidate) => candidate.startsWith(CHAT_CONTEXT_PREFIX));
	if (line === undefined) {
		return null;
	}
	try {
		const parsed = v.safeParse(
			ChatContextSchema,
			JSON.parse(line.slice(CHAT_CONTEXT_PREFIX.length)),
		);
		return parsed.success ? parsed.output : null;
	} catch {
		return null;
	}
}
