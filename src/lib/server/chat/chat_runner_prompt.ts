import { CHAT_ROLE } from '$lib/modules/chat/types.js';
import { CHAT_BLOCK, type ChatContentBlock } from './chat_model.js';
import { chatSystemPrompt, type ChatContext } from './chat_prompt.js';
import type { StoredChatMessage } from './chat_store.js';

/** Tool inputs and results beyond this length are cut, so old reads do not crowd the prompt. */
const TOOL_TEXT_MAX_LENGTH = 1500;

/**
 * Claude Code calls the chat's tools one by one, and the server proposes per call. Every text
 * block it writes reaches the user as a chat message, between tool calls too.
 */
const RUNNER_PROMPT_LINES = [
	'In this chat each change tool call forms its own proposal, which the user reviews in the chat, so put related changes into as few calls as their inputs allow.',
	"Every text you write is shown to the user as a chat message, so write text only as messages to the user, in the user's language. Do not narrate your progress or write notes to yourself between tool calls.",
];

export function chatRunnerSystemPrompt(context: ChatContext): string {
	return [chatSystemPrompt(context), ...RUNNER_PROMPT_LINES].join('\n\n');
}

function truncated(text: string): string {
	return text.length <= TOOL_TEXT_MAX_LENGTH
		? text
		: `${text.slice(0, TOOL_TEXT_MAX_LENGTH)}… (truncated)`;
}

function renderBlock(block: ChatContentBlock): string {
	switch (block.type) {
		case CHAT_BLOCK.text:
			return block.text;
		case CHAT_BLOCK.toolCall:
			return `[Tool call ${block.name}] ${truncated(JSON.stringify(block.input))}`;
		case CHAT_BLOCK.toolResult:
			return `[Tool ${block.isError ? 'error' : 'result'}] ${truncated(block.content)}`;
	}
}

function renderMessage(message: StoredChatMessage): string {
	const speaker = message.role === CHAT_ROLE.user ? 'User' : 'Assistant';
	return `${speaker}:\n${message.content.map(renderBlock).join('\n')}`;
}

/**
 * The chat so far as one prompt: Claude Code runs once per turn and has no memory of the chat,
 * so the earlier messages come as a transcript ending with the user's latest message.
 */
export function chatRunnerPrompt(messages: readonly StoredChatMessage[]): string {
	const latestUserIndex = messages.map((message) => message.role).lastIndexOf(CHAT_ROLE.user);
	const earlier = messages.slice(0, Math.max(latestUserIndex, 0));
	const latest = messages[latestUserIndex];
	const unfinishedAnswer = messages.slice(latestUserIndex + 1);
	const sections = [
		...(earlier.length === 0
			? []
			: [`The conversation so far:\n\n${earlier.map(renderMessage).join('\n\n')}`]),
		...(latest === undefined ? [] : [`The user's latest message:\n\n${renderMessage(latest)}`]),
		...(unfinishedAnswer.length === 0
			? []
			: [
					`Your answer to it stopped after these steps; continue it:\n\n${unfinishedAnswer.map(renderMessage).join('\n\n')}`,
				]),
	];
	return sections.join('\n\n---\n\n');
}
