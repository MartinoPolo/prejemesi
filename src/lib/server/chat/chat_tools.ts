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
import { CHAT_BROWSE_TOOL } from '$lib/modules/chat/types.js';
import {
	allowedBrowseUrlFromInput,
	browsePage,
	browsePageTool,
	isInputAddressInConversation,
	URL_NOT_IN_CONVERSATION_ERROR,
	type BrowsePageConfig,
	type BrowsePageContext,
	type BrowsePageResult,
} from './browse_page.js';
import { CHAT_BLOCK, type ChatModelContentBlock, type ChatModelTool } from './chat_model.js';

export type ChatToolResultBlock = Extract<
	ChatModelContentBlock,
	{ type: typeof CHAT_BLOCK.toolResult }
>;

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
		'readGiftShareDestinations',
		'shareGifts',
		'createWishlist',
		'createWishlistFromImport',
		'undoGiftRevisionBatch',
		'undoGiftRevision',
	] satisfies OperationName[]),
]);

const CHANGE_TOOL_NOTE =
	'The change joins the proposal of this response, which the user reviews in the chat.';

const CHAT_TOOL_KIND = { read: 'read', change: 'change', browse: 'browse' } as const;

/**
 * An agent operation the chat reads or changes through, or its own page browser, which binds its
 * configuration in `openPage` so the secret never sits in data a tool list is serialised from.
 */
export type ChatTool = ChatModelTool &
	(
		| { kind: typeof CHAT_TOOL_KIND.read | typeof CHAT_TOOL_KIND.change }
		| {
				kind: typeof CHAT_TOOL_KIND.browse;
				openPage: (input: unknown, context: BrowsePageContext) => Promise<BrowsePageResult>;
		  }
	);

/**
 * The agent tools the caller's grant allows, as the chat offers them to the model, and the page
 * browser when it is configured.
 */
export function chatTools(
	caller: AgentCaller,
	browsePageConfig: BrowsePageConfig | null,
): ChatTool[] {
	const agentTools = describeAgentMcpTools(caller)
		.filter(({ tool }) => !EXCLUDED_TOOL_NAMES.has(tool.name))
		.map(
			({ tool, summary, operationKind }): ChatTool =>
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
	if (browsePageConfig === null) {
		return agentTools;
	}
	return [
		...agentTools,
		{
			...browsePageTool,
			kind: CHAT_TOOL_KIND.browse,
			openPage: (input, context) => browsePage(browsePageConfig, input, context),
		},
	];
}

/** What a tool event shows beside the tool: the page a `browse_page` call opens. */
export function chatToolQuery(call: Pick<ChatToolCall, 'name' | 'input'>): string | null {
	return call.name === CHAT_BROWSE_TOOL
		? (allowedBrowseUrlFromInput(call.input)?.href ?? null)
		: null;
}

export interface ChatToolCall {
	id: string;
	name: string;
	input: unknown;
}

/** One response's tool calls run: a result per call, in call order, and the proposal they made. */
export interface ChatToolRound {
	results: ChatToolResultBlock[];
	proposal: { id: string; applied: boolean } | null;
}

function toolResult(toolCallId: string, body: unknown, isError: boolean): ChatToolResultBlock {
	return {
		type: CHAT_BLOCK.toolResult,
		toolCallId,
		content: JSON.stringify(body),
		isError,
	};
}

/** The UI's own message for a failure, so the assistant relays exactly what the app would say. */
function failureResult(toolCallId: string, thrown: unknown): ChatToolResultBlock {
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

/**
 * `uploadImage` downloads the address the model names, so like `browse_page` it may only use one
 * from `conversationUrls`; otherwise a prompt injection could send wishlist data out in that address.
 */
function downloadsOutsideConversation(
	call: ChatToolCall,
	urls: ReadonlySet<string> | null,
): boolean {
	return (
		call.name === AGENT_API_OPERATION_ID.uploadImage &&
		!isInputAddressInConversation(call.input, urls)
	);
}

async function runReadCall(
	caller: AgentCaller,
	call: ChatToolCall,
	{ imageBucket, conversationUrls }: ChatToolEnvironment,
): Promise<ChatToolResultBlock> {
	if (downloadsOutsideConversation(call, conversationUrls)) {
		return toolResult(call.id, { error: URL_NOT_IN_CONVERSATION_ERROR }, true);
	}
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

function browseResult(toolCallId: string, result: BrowsePageResult): ChatToolResultBlock {
	return result.ok
		? toolResult(toolCallId, result.page, false)
		: toolResult(toolCallId, { error: result.error }, true);
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
): Promise<{ results: Map<string, ChatToolResultBlock>; proposal: ChatToolRound['proposal'] }> {
	const results = new Map<string, ChatToolResultBlock>();
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
 * What the tools of one round run with: the image store, the turn's abort signal and the addresses
 * `browse_page` may open and `uploadImage` may download.
 */
export interface ChatToolEnvironment extends BrowsePageContext {
	imageBucket: AgentImageBucket | undefined;
}

/**
 * Runs one response's tool calls as the chat's caller: reads and page loads at once, changes
 * collected into one proposal on the chat's wishlist, which applies at once only under
 * fast-forward.
 */
export async function runChatToolCalls(
	caller: AgentCaller,
	tools: readonly ChatTool[],
	wishlistId: string,
	calls: readonly ChatToolCall[],
	environment: ChatToolEnvironment,
): Promise<ChatToolRound> {
	const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
	const results = new Map<string, ChatToolResultBlock>();
	const changes: ChatToolCall[] = [];
	for (const call of calls) {
		const tool = toolsByName.get(call.name);
		const startedAt = Date.now();
		if (tool?.kind === CHAT_TOOL_KIND.change) {
			changes.push(call);
			continue;
		}
		let result: ChatToolResultBlock;
		if (tool?.kind === CHAT_TOOL_KIND.read) {
			result = await runReadCall(caller, call, environment);
		} else if (tool?.kind === CHAT_TOOL_KIND.browse) {
			result = browseResult(call.id, await tool.openPage(call.input, environment));
		} else {
			result = toolResult(call.id, { error: { code: 'UNKNOWN_TOOL' } }, true);
		}
		results.set(call.id, { ...result, durationMs: Date.now() - startedAt });
	}
	let proposal: ChatToolRound['proposal'] = null;
	if (changes.length > 0) {
		const startedAt = Date.now();
		const submitted = await submitChanges(caller, wishlistId, changes);
		// The changes form one proposal, so each reports the time the whole submission took.
		const durationMs = Date.now() - startedAt;
		submitted.results.forEach((result, callId) =>
			results.set(callId, { ...result, durationMs }),
		);
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
