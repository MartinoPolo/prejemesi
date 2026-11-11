import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { isAgentScope, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import { bearerValue } from './access_tokens.js';
import { AGENT_CREDENTIAL_KIND, type AgentCaller } from './agent_caller.js';
import {
	insufficientScopeChallenge,
	unauthorizedChallenge,
	type OauthAccessVerifier,
} from './oauth_access.js';
import {
	authenticateAgentRequest,
	describeAgentApiFailure,
	type AgentApiErrorBody,
	type AgentApiEvent,
	type AgentApiResponse,
} from './api.js';
import { callAgentMcpTool, isAgentMcpTool, listAgentMcpTools } from './mcp_tools.js';
import { AGENT_API_OPERATION_ID } from './openapi.js';
import { IMAGE_REFERENCE_FIELD, IMAGE_REFERENCES_FIELD } from './image_references.js';
import { MAX_GIFT_IMAGES } from '$lib/modules/gifts/gift_images.js';
import {
	JSON_RPC_ERROR,
	JsonRpcError,
	agentFailureResponse,
	handleMcpMessage,
	isJsonObject,
	jsonRpcErrorResponse,
	type McpToolResult,
	type McpToolset,
} from './mcp_protocol.js';

/**
 * The remote MCP server at `/mcp`, on the shared stateless protocol handler; the MCP SDK would add
 * its own validators and schema library to the Worker for the same result. Credentials are
 * bearer tokens, never cookies, and responses carry no CORS headers, so a browser page cannot
 * drive it and DNS rebinding has nothing to gain.
 */

const SERVER_INSTRUCTIONS = [
	'Přejeme si is a family wishlist app. Every tool acts as the user who created the access token or connected this app, with exactly that user’s rights; recipients never see reservations.',
	`Start with ${AGENT_API_OPERATION_ID.listWishlists}. Changes are proposals: show the user the review link a change answers with, where they review and apply it. A fast-forward personal access token applies a proposal at once only when every row is ready and none needs confirmation; one deletion, reservation, manager invitation or rejected row makes the whole proposal wait for the user, and its fastForwardHold says why. Connected apps never fast-forward.`,
	`Put related changes to one wishlist into one ${AGENT_API_OPERATION_ID.submitChangeProposal} call with an idempotencyKey, so a retry never repeats them. For a gift image, call ${AGENT_API_OPERATION_ID.uploadImage} and set its reference as ${IMAGE_REFERENCE_FIELD}.`,
	`For several photos of one gift, set ${IMAGE_REFERENCES_FIELD} to up to ${String(MAX_GIFT_IMAGES)} ordered references: the first is the cover and the list replaces the whole gallery, while ${IMAGE_REFERENCE_FIELD} changes only the cover.`,
].join('\n\n');

interface McpEvent extends AgentApiEvent {
	url: URL;
	platform?: AgentApiEvent['platform'] & { env: { R2?: AgentImageBucket } };
}

/**
 * A tool call an app's token lacks the scope for. Unlike a token's, it answers HTTP 403 with a
 * step-up challenge, so the app can ask its user for the scope and retry.
 */
class ScopeStepUp extends Error {
	constructor(
		readonly scope: AgentScope,
		readonly body: AgentApiErrorBody,
	) {
		super(body.error.message);
	}
}

function reviewLinkOf(body: unknown, origin: string): string | null {
	if (!isJsonObject(body) || !isJsonObject(body.proposal)) {
		return null;
	}
	const { reviewUrl, status } = body.proposal;
	if (typeof reviewUrl !== 'string' || typeof status !== 'string') {
		return null;
	}
	return `Review page for the user (proposal ${status}): ${new URL(reviewUrl, origin).href}`;
}

/** A tool's answer: the endpoint's JSON body as structured content and as text. */
function toolResult(response: AgentApiResponse, origin: string, isError: boolean): McpToolResult {
	const reviewLink = reviewLinkOf(response.body, origin);
	return {
		content: [
			...(reviewLink === null ? [] : [{ type: 'text' as const, text: reviewLink }]),
			{ type: 'text', text: JSON.stringify(response.body) },
		],
		structuredContent: isJsonObject(response.body) ? response.body : { value: response.body },
		isError,
	};
}

async function callTool(
	caller: AgentCaller,
	name: string,
	toolArguments: Record<string, unknown>,
	event: McpEvent,
): Promise<McpToolResult> {
	// Tool failures are results the model reads, not protocol errors.
	try {
		const response = await callAgentMcpTool(
			caller,
			name,
			toolArguments,
			event.platform?.env.R2,
		);
		return toolResult(response, event.url.origin, false);
	} catch (thrown) {
		const failure = describeAgentApiFailure(thrown);
		const { code, scope } = failure.body.error;
		if (
			caller.credential.kind === AGENT_CREDENTIAL_KIND.oauthGrant &&
			code === SERVER_ERROR.AGENT_SCOPE_MISSING &&
			typeof scope === 'string' &&
			isAgentScope(scope)
		) {
			throw new ScopeStepUp(scope, failure.body);
		}
		return toolResult({ body: failure.body, status: failure.status }, event.url.origin, true);
	}
}

/**
 * Answers one MCP message posted to the endpoint. Every request authenticates like the agent
 * API, including its demo rejection and per-credential request limit; with `oauth`, an app's
 * access token bound to this endpoint authenticates too.
 */
export async function handleMcpRequest(
	event: McpEvent,
	oauth?: OauthAccessVerifier,
): Promise<Response> {
	let caller: AgentCaller | undefined;
	return handleMcpMessage(event.request, {
		authenticate: async (): Promise<McpToolset> => {
			const authenticated = await authenticateAgentRequest(event, oauth);
			caller = authenticated;
			return {
				instructions: SERVER_INSTRUCTIONS,
				listTools: () => listAgentMcpTools(authenticated),
				hasTool: isAgentMcpTool,
				callTool: (name, toolArguments) =>
					callTool(authenticated, name, toolArguments, event),
			};
		},
		// A 401 names where an app discovers how to sign in (RFC 9728), whether or not a token came.
		failureResponse: (thrown) =>
			agentFailureResponse(null, thrown, (status): Record<string, string> => {
				if (status !== 401) {
					return {};
				}
				const tokenPresented =
					bearerValue(event.request.headers.get('authorization')) !== null;
				return {
					'www-authenticate':
						oauth === undefined
							? 'Bearer'
							: unauthorizedChallenge(oauth.endpoints, tokenPresented),
				};
			}),
		requestFailureResponse: (id, thrown) => {
			if (!(thrown instanceof ScopeStepUp) || oauth === undefined || caller === undefined) {
				return null;
			}
			return jsonRpcErrorResponse(
				id,
				new JsonRpcError(JSON_RPC_ERROR.server, thrown.message, thrown.body.error),
				403,
				{
					'www-authenticate': insufficientScopeChallenge(
						oauth.endpoints,
						caller.grant.scopes,
						thrown.scope,
					),
				},
			);
		},
	});
}
