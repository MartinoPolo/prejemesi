import { CHAT_ROLE } from '$lib/modules/chat/types.js';
import {
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalState,
	type ChangeRowStatus,
} from '$lib/modules/change_proposals/types.js';
import { CHAT_BLOCK, type ChatContentBlock } from './chat_model.js';
import { chatSystemPrompt, type ChatContext } from './chat_prompt.js';
import type { StoredChatMessage } from './chat_store.js';

/** Tool inputs and results beyond this length are cut, so old reads do not crowd the prompt. */
const TOOL_TEXT_MAX_LENGTH = 1500;

/** Each proposal state as the runner reads it, with a meaning where the name alone is unclear. */
const PROPOSAL_STATE_MEANING: Record<ChangeProposalState, string | null> = {
	[CHANGE_PROPOSAL_STATE.pending]: 'waiting for the user',
	[CHANGE_PROPOSAL_STATE.applied]: null,
	[CHANGE_PROPOSAL_STATE.discarded]: 'the user rejected it',
	[CHANGE_PROPOSAL_STATE.expired]: null,
	[CHANGE_PROPOSAL_STATE.undone]: null,
};

const proposalStateDescriptions = Object.entries(PROPOSAL_STATE_MEANING).map(([state, meaning]) =>
	meaning === null ? state : `${state} (${meaning})`,
);
const proposalStateList = `${proposalStateDescriptions.slice(0, -1).join(', ')} or ${proposalStateDescriptions.at(-1) ?? ''}`;

/**
 * Claude Code calls the chat's tools one by one, and the server proposes per call. Every text
 * block it writes reaches the user as a chat message, between tool calls too. It runs once per
 * turn, so the transcript tells it what became of the proposals it made earlier.
 */
const RUNNER_PROMPT_LINES = [
	'In this chat each change tool call forms its own proposal, which the user reviews in the chat, so put related changes into as few calls as their inputs allow.',
	"Every text you write is shown to the user as a chat message, so write text only as messages to the user, in the user's language. Do not narrate your progress or write notes to yourself between tool calls.",
	`In the conversation, each proposal is followed by its state now: ${proposalStateList}. Only applied changes are on the wishlist. A gift a proposal creates exists only once that proposal is applied, under the id in its applied result; the ids in the results of unapplied proposals name no gift. Propose a discarded or expired change again if the user still wants it; to change a gift a pending proposal creates, propose its creation again with the change.`,
];

export function chatRunnerSystemPrompt(context: ChatContext): string {
	return [chatSystemPrompt(context), ...RUNNER_PROMPT_LINES].join('\n\n');
}

/** What became of a proposal the chat made, as its agent view reports it. */
export interface ChatProposalOutcome {
	status: ChangeProposalState;
	rows: readonly { operation: string; status: ChangeRowStatus; result: unknown }[];
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

/** The proposal's state; once applied, each row's outcome with the result of the applied ones. */
function renderProposalOutcome(proposalId: string, outcome: ChatProposalOutcome): string {
	const settled =
		outcome.status === CHANGE_PROPOSAL_STATE.applied ||
		outcome.status === CHANGE_PROPOSAL_STATE.undone;
	const rows = settled
		? outcome.rows.map((row) =>
				row.status === CHANGE_ROW_STATUS.applied
					? `${row.operation} applied, result ${truncated(JSON.stringify(row.result))}`
					: `${row.operation} ${row.status}`,
			)
		: [];
	return [`[Proposal ${proposalId} is now ${outcome.status}]`, ...rows].join('\n');
}

function renderMessage(
	message: StoredChatMessage,
	proposalOutcomes: ReadonlyMap<string, ChatProposalOutcome>,
): string {
	const speaker = message.role === CHAT_ROLE.user ? 'User' : 'Assistant';
	const lines = message.content.map(renderBlock);
	if (message.proposalId !== null) {
		const outcome = proposalOutcomes.get(message.proposalId);
		if (outcome !== undefined) {
			lines.push(renderProposalOutcome(message.proposalId, outcome));
		}
	}
	return `${speaker}:\n${lines.join('\n')}`;
}

/**
 * The chat so far as one prompt: Claude Code runs once per turn and has no memory of the chat,
 * so the earlier messages come as a transcript ending with the user's latest message, each
 * proposal with what became of it.
 */
export function chatRunnerPrompt(
	messages: readonly StoredChatMessage[],
	proposalOutcomes: ReadonlyMap<string, ChatProposalOutcome>,
): string {
	const render = (message: StoredChatMessage) => renderMessage(message, proposalOutcomes);
	const latestUserIndex = messages.map((message) => message.role).lastIndexOf(CHAT_ROLE.user);
	const earlier = messages.slice(0, Math.max(latestUserIndex, 0));
	const latest = messages[latestUserIndex];
	const unfinishedAnswer = messages.slice(latestUserIndex + 1);
	const sections = [
		...(earlier.length === 0
			? []
			: [`The conversation so far:\n\n${earlier.map(render).join('\n\n')}`]),
		...(latest === undefined ? [] : [`The user's latest message:\n\n${render(latest)}`]),
		...(unfinishedAnswer.length === 0
			? []
			: [
					`Your answer to it stopped after these steps; continue it:\n\n${unfinishedAnswer.map(render).join('\n\n')}`,
				]),
	];
	return sections.join('\n\n---\n\n');
}
