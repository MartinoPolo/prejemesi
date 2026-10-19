import { describeAgentApiFailure } from '$lib/server/agent_access/api.js';
import type { AgentCaller } from '$lib/server/agent_access/agent_caller.js';
import { submitChangeProposal } from '$lib/server/agent_access/change_proposal_api.js';
import { callAgentMcpTool, describeAgentMcpTools } from '$lib/server/agent_access/mcp_tools.js';
import { AGENT_API_OPERATION_ID } from '$lib/server/agent_access/openapi.js';
import type { OperationName } from '$lib/server/agent_access/operation_policies.js';
import { reorderGiftsOperation } from '$lib/server/operations/gift_bulk_operations.js';
import { OPERATION_KIND } from '$lib/server/operations/operation.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { CHANGE_PROPOSAL_STATUS } from '$lib/modules/change_proposals/types.js';
import { translateServerErrorCode } from '$lib/modules/errors/translate_server_error.js';
import { CHAT_BLOCK, type ChatContentBlock, type ChatModelTool } from './chat_model.js';

/**
 * Tools a chat about one wishlist has no use for: the chat submits and applies proposals itself,
 * other wishlists are outside its grant, and undo stays with the UI that shows the change.
 */
const EXCLUDED_TOOL_NAMES: ReadonlySet<string> = new Set([
	AGENT_API_OPERATION_ID.me,
	AGENT_API_OPERATION_ID.listWishlists,
	AGENT_API_OPERATION_ID.submitChangeProposal,
	AGENT_API_OPERATION_ID.getChangeProposal,
	AGENT_API_OPERATION_ID.applyChangeProposal,
	...([
		'readAccessibleWishlists',
		'readBulkCopyDestinations',
		'bulkCopyGifts',
		'createWishlist',
		'createWishlistFromImport',
		'undoGiftRevisionBatch',
		'undoGiftRevision',
	] satisfies OperationName[]),
]);

const CHANGE_TOOL_NOTE =
	'The change joins the proposal of this response, which the user reviews in the chat.';

const CHAT_TOOL_KIND = { read: 'read', change: 'change' } as const;

export interface ChatTool extends ChatModelTool {
	kind: (typeof CHAT_TOOL_KIND)[keyof typeof CHAT_TOOL_KIND];
}

/** The agent tools the caller's grant allows, as the chat offers them to the model. */
export function chatTools(caller: AgentCaller): ChatTool[] {
	return describeAgentMcpTools(caller)
		.filter(({ tool }) => !EXCLUDED_TOOL_NAMES.has(tool.name))
		.map(({ tool, summary, operationKind }) =>
			operationKind === OPERATION_KIND.mutation
				? {
						name: tool.name,
						description: `${summary} ${CHANGE_TOOL_NOTE}`,
						inputSchema: tool.inputSchema,
						kind: CHAT_TOOL_KIND.change,
					}
				: {
						name: tool.name,
						description: tool.description,
						inputSchema: tool.inputSchema,
						kind: CHAT_TOOL_KIND.read,
					},
		);
}

export interface ChatToolCall {
	id: string;
	name: string;
	input: unknown;
}

/** One response's tool calls run: a result per call, in call order, and the proposal they made. */
export interface ChatToolRound {
	results: ChatContentBlock[];
	proposal: { id: string; applied: boolean } | null;
}

function toolResult(toolCallId: string, body: unknown, isError: boolean): ChatContentBlock {
	return {
		type: CHAT_BLOCK.toolResult,
		toolCallId,
		content: JSON.stringify(body),
		isError,
	};
}

/** The UI's own message for a failure, so the assistant relays exactly what the app would say. */
function failureResult(toolCallId: string, thrown: unknown): ChatContentBlock {
	const { body } = describeAgentApiFailure(thrown);
	const { code, message, ...details } = body.error;
	return toolResult(
		toolCallId,
		{ error: { code, message: translateServerErrorCode(code, details, message) } },
		true,
	);
}

function isArgumentObject(input: unknown): input is Record<string, unknown> {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}

async function runReadCall(
	caller: AgentCaller,
	call: ChatToolCall,
	imageBucket: AgentImageBucket | undefined,
): Promise<ChatContentBlock> {
	try {
		const response = await callAgentMcpTool(
			caller,
			call.name,
			isArgumentObject(call.input) ? call.input : {},
			imageBucket,
		);
		return toolResult(call.id, response.body, false);
	} catch (thrown) {
		return failureResult(call.id, thrown);
	}
}

/** Reorders are low risk, so they apply without review even when fast-forward is off. */
function appliesWithoutReview(caller: AgentCaller, changes: readonly ChatToolCall[]): boolean {
	return (
		caller.fastForward || changes.every((change) => change.name === reorderGiftsOperation.name)
	);
}

/** Every change of one response becomes one proposal; each call reads back its own row. */
async function submitChanges(
	caller: AgentCaller,
	wishlistId: string,
	changes: readonly ChatToolCall[],
): Promise<{ results: Map<string, ChatContentBlock>; proposal: ChatToolRound['proposal'] }> {
	const results = new Map<string, ChatContentBlock>();
	try {
		const proposal = await submitChangeProposal(
			{ ...caller, fastForward: appliesWithoutReview(caller, changes) },
			{
				wishlistId,
				operations: changes.map((change) => ({
					operation: change.name,
					input: change.input,
				})),
			},
		);
		const applied = proposal.status === CHANGE_PROPOSAL_STATUS.applied;
		changes.forEach((change, index) => {
			const row = proposal.rows[index];
			const error =
				row?.error == null
					? null
					: {
							code: row.error.code,
							message: translateServerErrorCode(row.error.code, row.error.details),
						};
			results.set(
				change.id,
				toolResult(
					change.id,
					{
						proposalId: proposal.id,
						applied,
						status: row?.status,
						requiresConfirmation: row?.requiresConfirmation ?? false,
						result: row?.result ?? null,
						error,
					},
					error !== null,
				),
			);
		});
		return { results, proposal: { id: proposal.id, applied } };
	} catch (thrown) {
		for (const change of changes) {
			results.set(change.id, failureResult(change.id, thrown));
		}
		return { results, proposal: null };
	}
}

/**
 * Runs one response's tool calls as the chat's caller: reads at once, changes collected into one
 * proposal on the chat's wishlist, which applies at once only under fast-forward.
 */
export async function runChatToolCalls(
	caller: AgentCaller,
	tools: readonly ChatTool[],
	wishlistId: string,
	calls: readonly ChatToolCall[],
	imageBucket: AgentImageBucket | undefined,
): Promise<ChatToolRound> {
	const toolKinds = new Map(tools.map((tool) => [tool.name, tool.kind]));
	const results = new Map<string, ChatContentBlock>();
	const changes: ChatToolCall[] = [];
	for (const call of calls) {
		const kind = toolKinds.get(call.name);
		if (kind === CHAT_TOOL_KIND.change) {
			changes.push(call);
		} else if (kind === CHAT_TOOL_KIND.read) {
			results.set(call.id, await runReadCall(caller, call, imageBucket));
		} else {
			results.set(call.id, toolResult(call.id, { error: { code: 'UNKNOWN_TOOL' } }, true));
		}
	}
	let proposal: ChatToolRound['proposal'] = null;
	if (changes.length > 0) {
		const submitted = await submitChanges(caller, wishlistId, changes);
		submitted.results.forEach((result, callId) => results.set(callId, result));
		proposal = submitted.proposal;
	}
	return {
		results: calls.flatMap((call) => {
			const result = results.get(call.id);
			return result === undefined ? [] : [result];
		}),
		proposal,
	};
}
