import * as v from 'valibot';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { AgentApiFailure, describeAgentApiFailure, readJsonBody } from './api.js';

/**
 * Stateless Streamable HTTP MCP for a tools-only server: every JSON-RPC request gets one JSON
 * response, with no event stream or session. Each endpoint supplies its authentication and its
 * tools; this much of the protocol is all they need.
 */

const JSON_RPC_VERSION = '2.0';
/** Newest first; an unknown requested version is answered with the newest. */
const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
const MCP_PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

export const JSON_RPC_ERROR = {
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

export type JsonRpcId = string | number;

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

/** A tool's answer; a failed tool is a result the model reads, not a protocol error. */
export interface McpToolResult {
	content: { type: 'text'; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError: boolean;
}

/** What an authenticated caller may use on one endpoint. */
export interface McpToolset {
	instructions: string;
	listTools(): unknown[];
	hasTool(name: string): boolean;
	callTool(name: string, toolArguments: Record<string, unknown>): Promise<McpToolResult>;
}

export interface McpEndpoint {
	/** Authenticates the request before its message is read; a throw refuses it. */
	authenticate(): Promise<McpToolset>;
	/** The HTTP answer to a refused authentication or an unreadable body. */
	failureResponse(thrown: unknown): Response;
	/** An endpoint's own answer to a failure while answering a request, or null for the default. */
	requestFailureResponse?(id: JsonRpcId, thrown: unknown): Response | null;
}

export class JsonRpcError extends Error {
	constructor(
		readonly code: number,
		message: string,
		readonly data?: unknown,
	) {
		super(message);
	}
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mcpJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

export function jsonRpcErrorResponse(
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
 * An agent API failure as a JSON-RPC server error. Before any message is read it answers with
 * the failure's own HTTP status and headers; for a request, with the request's id.
 */
export function agentFailureResponse(
	id: JsonRpcId | null,
	thrown: unknown,
	headersForStatus: (status: number) => Record<string, string> = () => ({}),
): Response {
	const failure = describeAgentApiFailure(thrown);
	const error = new JsonRpcError(
		JSON_RPC_ERROR.server,
		failure.body.error.message,
		failure.body.error,
	);
	return id === null
		? jsonRpcErrorResponse(null, error, failure.status, {
				...failure.headers,
				...headersForStatus(failure.status),
			})
		: jsonRpcErrorResponse(id, error);
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

async function callTool(toolset: McpToolset, params: unknown): Promise<McpToolResult> {
	const parsed = v.safeParse(CallToolParamsSchema, params);
	if (!parsed.success) {
		throw new JsonRpcError(JSON_RPC_ERROR.invalidParams, 'tools/call needs a tool name');
	}
	const { name, arguments: toolArguments } = parsed.output;
	if (!toolset.hasTool(name)) {
		throw new JsonRpcError(JSON_RPC_ERROR.invalidParams, `Unknown tool: ${name}`);
	}
	return toolset.callTool(name, toolArguments);
}

async function answerRequest(
	toolset: McpToolset,
	method: string,
	params: unknown,
): Promise<unknown> {
	switch (method) {
		case MCP_METHOD.initialize:
			return {
				protocolVersion: negotiatedProtocolVersion(params),
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions: toolset.instructions,
			};
		case MCP_METHOD.ping:
			return {};
		case MCP_METHOD.listTools:
			return { tools: toolset.listTools() };
		case MCP_METHOD.callTool:
			return callTool(toolset, params);
		default:
			throw new JsonRpcError(JSON_RPC_ERROR.methodNotFound, `Method not found: ${method}`);
	}
}

/** Answers one MCP message posted to an endpoint. */
export async function handleMcpMessage(request: Request, endpoint: McpEndpoint): Promise<Response> {
	let toolset: McpToolset;
	let message: unknown;
	try {
		toolset = await endpoint.authenticate();
		const protocolVersion = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
		if (
			protocolVersion !== null &&
			!MCP_PROTOCOL_VERSIONS.some((version) => version === protocolVersion)
		) {
			return jsonRpcErrorResponse(
				null,
				new JsonRpcError(
					JSON_RPC_ERROR.invalidRequest,
					`Unsupported MCP protocol version ${protocolVersion}`,
				),
				400,
			);
		}
		message = (await readJsonBody(request)).parsed;
	} catch (thrown) {
		if (
			thrown instanceof AgentApiFailure &&
			thrown.code === SERVER_ERROR.AGENT_REQUEST_INVALID
		) {
			return jsonRpcErrorResponse(
				null,
				new JsonRpcError(JSON_RPC_ERROR.parseError, 'Parse error'),
				400,
			);
		}
		return endpoint.failureResponse(thrown);
	}

	const incoming = classifyMessage(message);
	if (incoming.kind === 'noReply') {
		return new Response(null, { status: 202 });
	}
	if (incoming.kind === 'invalid') {
		return jsonRpcErrorResponse(
			null,
			new JsonRpcError(
				JSON_RPC_ERROR.invalidRequest,
				'Expected one JSON-RPC 2.0 message; batches are not supported',
			),
			400,
		);
	}
	try {
		const result = await answerRequest(toolset, incoming.method, incoming.params);
		return mcpJson({ jsonrpc: JSON_RPC_VERSION, id: incoming.id, result });
	} catch (thrown) {
		if (thrown instanceof JsonRpcError) {
			return jsonRpcErrorResponse(incoming.id, thrown);
		}
		return (
			endpoint.requestFailureResponse?.(incoming.id, thrown) ??
			agentFailureResponse(incoming.id, thrown)
		);
	}
}
