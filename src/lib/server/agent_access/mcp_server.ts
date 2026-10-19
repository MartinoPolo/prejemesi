import * as v from 'valibot';
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
	AgentApiFailure,
	authenticateAgentRequest,
	describeAgentApiFailure,
	readJsonBody,
	type AgentApiErrorBody,
	type AgentApiEvent,
	type AgentApiResponse,
} from './api.js';
import { callAgentMcpTool, isAgentMcpTool, listAgentMcpTools } from './mcp_tools.js';
import { AGENT_API_OPERATION_ID } from './openapi.js';

/**
 * The remote MCP server: stateless Streamable HTTP that answers every JSON-RPC request with one
 * JSON response and offers no event stream or session. It serves tools only, which needs this
 * much of the protocol; the MCP SDK would add its own validators and schema library to the
 * Worker for the same result. Credentials are bearer tokens, never cookies, and responses carry
 * no CORS headers, so a browser page cannot drive it and DNS rebinding has nothing to gain.
 */

const JSON_RPC_VERSION = '2.0';
/** Newest first; an unknown requested version is answered with the newest. */
const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
const MCP_PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

const JSON_RPC_ERROR = {
	parseError: -32700,
	invalidRequest: -32600,
	methodNotFound: -32601,
	invalidParams: -32602,
	/** Implementation-defined: authentication, limits and transport failures. */
	server: -32000,
} as const;

const MCP_METHOD = {
	initialize: 'initialize',
	ping: 'ping',
	listTools: 'tools/list',
	callTool: 'tools/call',
} as const;

const SERVER_INFO = { name: 'prejemesi', title: 'Přejeme si', version: '1' } as const;

const SERVER_INSTRUCTIONS = [
	'Přejeme si is a family wishlist app. Every tool acts as the user who created the access token or connected this app, with exactly that user’s rights; recipients never see reservations.',
	`Start with ${AGENT_API_OPERATION_ID.listWishlists}. Changes are proposals: show the user the review link a change answers with, where they review and apply it. A fast-forward token applies ready changes at once, but deletions, reservations and manager invitations always wait for the user.`,
	`Put related changes to one wishlist into one ${AGENT_API_OPERATION_ID.submitChangeProposal} call with an idempotencyKey, so a retry never repeats them. For a gift image, call ${AGENT_API_OPERATION_ID.uploadImage} and set its reference as imageReference.`,
].join('\n\n');

type JsonRpcId = string | number;

const JsonRpcIdSchema = v.union([v.string(), v.number()]);

const InitializeParamsSchema = v.object({ protocolVersion: v.string() });

const CallToolParamsSchema = v.object({
	name: v.string(),
	arguments: v.optional(v.record(v.string(), v.unknown()), {}),
});

type IncomingMessage =
	| { kind: 'request'; id: JsonRpcId; method: string; params: unknown }
	/** Notifications and the client's responses need no answer. */
	| { kind: 'noReply' }
	| { kind: 'invalid' };

interface McpEvent extends AgentApiEvent {
	url: URL;
	platform?: AgentApiEvent['platform'] & { env: { R2?: AgentImageBucket } };
}

class JsonRpcError extends Error {
	constructor(
		readonly code: number,
		message: string,
		readonly data?: unknown,
	) {
		super(message);
	}
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

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mcpJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function errorResponse(
	id: JsonRpcId | null,
	error: JsonRpcError,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return mcpJson(
		{
			jsonrpc: JSON_RPC_VERSION,
			id,
			error: {
				code: error.code,
				message: error.message,
				...(error.data === undefined ? {} : { data: error.data }),
			},
		},
		status,
		headers,
	);
}

/**
 * An agent API failure before any message is read, answered with its own HTTP status. A 401
 * names where an app discovers how to sign in (RFC 9728), whether or not a token came along.
 */
function failureResponse(thrown: unknown, event: McpEvent, oauth?: OauthAccessVerifier): Response {
	const failure = describeAgentApiFailure(thrown);
	const tokenPresented = bearerValue(event.request.headers.get('authorization')) !== null;
	const challenge =
		oauth === undefined ? 'Bearer' : unauthorizedChallenge(oauth.endpoints, tokenPresented);
	const headers =
		failure.status === 401
			? { ...failure.headers, 'www-authenticate': challenge }
			: failure.headers;
	return errorResponse(
		null,
		new JsonRpcError(JSON_RPC_ERROR.server, failure.body.error.message, failure.body.error),
		failure.status,
		headers,
	);
}

function classifyMessage(message: unknown): IncomingMessage {
	if (!isJsonObject(message) || message.jsonrpc !== JSON_RPC_VERSION) {
		return { kind: 'invalid' };
	}
	if (typeof message.method === 'string') {
		if (!Object.hasOwn(message, 'id')) {
			return { kind: 'noReply' };
		}
		const id = v.safeParse(JsonRpcIdSchema, message.id);
		return id.success
			? { kind: 'request', id: id.output, method: message.method, params: message.params }
			: { kind: 'invalid' };
	}
	return Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error')
		? { kind: 'noReply' }
		: { kind: 'invalid' };
}

function negotiatedProtocolVersion(params: unknown): string {
	const parsed = v.safeParse(InitializeParamsSchema, params);
	if (!parsed.success) {
		throw new JsonRpcError(JSON_RPC_ERROR.invalidParams, 'initialize needs a protocolVersion');
	}
	const requested = parsed.output.protocolVersion;
	return (
		MCP_PROTOCOL_VERSIONS.find((version) => version === requested) ?? MCP_PROTOCOL_VERSIONS[0]
	);
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
function toolResult(response: AgentApiResponse, origin: string, isError: boolean) {
	const reviewLink = reviewLinkOf(response.body, origin);
	return {
		content: [
			...(reviewLink === null ? [] : [{ type: 'text', text: reviewLink }]),
			{ type: 'text', text: JSON.stringify(response.body) },
		],
		structuredContent: isJsonObject(response.body) ? response.body : { value: response.body },
		isError,
	};
}

async function callTool(
	caller: AgentCaller,
	params: unknown,
	event: McpEvent,
): Promise<ReturnType<typeof toolResult>> {
	const parsed = v.safeParse(CallToolParamsSchema, params);
	if (!parsed.success) {
		throw new JsonRpcError(JSON_RPC_ERROR.invalidParams, 'tools/call needs a tool name');
	}
	const { name, arguments: toolArguments } = parsed.output;
	if (!isAgentMcpTool(name)) {
		throw new JsonRpcError(JSON_RPC_ERROR.invalidParams, `Unknown tool: ${name}`);
	}
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

async function answerRequest(
	caller: AgentCaller,
	method: string,
	params: unknown,
	event: McpEvent,
): Promise<unknown> {
	switch (method) {
		case MCP_METHOD.initialize:
			return {
				protocolVersion: negotiatedProtocolVersion(params),
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions: SERVER_INSTRUCTIONS,
			};
		case MCP_METHOD.ping:
			return {};
		case MCP_METHOD.listTools:
			return { tools: listAgentMcpTools(caller) };
		case MCP_METHOD.callTool:
			return callTool(caller, params, event);
		default:
			throw new JsonRpcError(JSON_RPC_ERROR.methodNotFound, `Method not found: ${method}`);
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
	let caller: AgentCaller;
	let message: unknown;
	try {
		caller = await authenticateAgentRequest(event, oauth);
		const protocolVersion = event.request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
		if (
			protocolVersion !== null &&
			!MCP_PROTOCOL_VERSIONS.some((version) => version === protocolVersion)
		) {
			return errorResponse(
				null,
				new JsonRpcError(
					JSON_RPC_ERROR.invalidRequest,
					`Unsupported MCP protocol version ${protocolVersion}`,
				),
				400,
			);
		}
		message = (await readJsonBody(event.request)).parsed;
	} catch (thrown) {
		if (
			thrown instanceof AgentApiFailure &&
			thrown.code === SERVER_ERROR.AGENT_REQUEST_INVALID
		) {
			return errorResponse(
				null,
				new JsonRpcError(JSON_RPC_ERROR.parseError, 'Parse error'),
				400,
			);
		}
		return failureResponse(thrown, event, oauth);
	}

	const incoming = classifyMessage(message);
	if (incoming.kind === 'noReply') {
		return new Response(null, { status: 202 });
	}
	if (incoming.kind === 'invalid') {
		return errorResponse(
			null,
			new JsonRpcError(
				JSON_RPC_ERROR.invalidRequest,
				'Expected one JSON-RPC 2.0 message; batches are not supported',
			),
			400,
		);
	}
	try {
		const result = await answerRequest(caller, incoming.method, incoming.params, event);
		return mcpJson({ jsonrpc: JSON_RPC_VERSION, id: incoming.id, result });
	} catch (thrown) {
		if (thrown instanceof JsonRpcError) {
			return errorResponse(incoming.id, thrown);
		}
		if (thrown instanceof ScopeStepUp && oauth !== undefined) {
			return errorResponse(
				incoming.id,
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
		}
		const failure = describeAgentApiFailure(thrown);
		return errorResponse(
			incoming.id,
			new JsonRpcError(JSON_RPC_ERROR.server, failure.body.error.message, failure.body.error),
		);
	}
}
