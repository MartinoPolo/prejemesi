import * as v from 'valibot';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { AGENT_SCOPE, type AgentScope } from '$lib/modules/access_tokens/scopes.js';
import { OPERATION_KIND, type AnyOperation } from '$lib/server/operations/operation.js';
import type { AgentImageBucket } from '$lib/server/storage/r2.js';
import type { AuthenticatedAccessToken } from './access_tokens.js';
import { hasAgentScope, type AgentAccessGrant } from './agent_grant.js';
import { AgentApiFailure, runIdempotently, type AgentApiResponse } from './api.js';
import {
	imageUploadResponse,
	meResponse,
	operationReadResponse,
	proposalResponse,
	proposalSubmissionResponse,
	singleChangeSubmissionResponse,
	wishlistsResponse,
} from './endpoint_handlers.js';
import { AGENT_API_OPERATION_ID, buildAgentApiDocument } from './openapi.js';

type OperationKind = AnyOperation['kind'];

/** MCP tool arguments carry what HTTP sends as headers under these names. */
const HEADER_ARGUMENT_NAMES: Readonly<Record<string, string>> = {
	'Idempotency-Key': 'idempotencyKey',
};
const IDEMPOTENCY_KEY_ARGUMENT = 'idempotencyKey';
const PARAMETER_LOCATION = { path: 'path', header: 'header' } as const;

const JsonObjectSchema = v.record(v.string(), v.unknown());

const DocumentedOperationSchema = v.object({
	operationId: v.string(),
	summary: v.string(),
	description: v.optional(v.string()),
	'x-scope': v.optional(v.picklist(Object.values(AGENT_SCOPE))),
	'x-operation-kind': v.optional(v.picklist(Object.values(OPERATION_KIND))),
	'x-confirmation': v.optional(v.string()),
	parameters: v.optional(
		v.array(
			v.object({
				name: v.string(),
				in: v.picklist(Object.values(PARAMETER_LOCATION)),
				required: v.optional(v.boolean()),
				description: v.optional(v.string()),
				schema: JsonObjectSchema,
			}),
		),
	),
	requestBody: v.optional(
		v.object({
			content: v.object({ 'application/json': v.object({ schema: JsonObjectSchema }) }),
		}),
	),
});

type DocumentedOperation = v.InferOutput<typeof DocumentedOperationSchema>;

/** A tool as `tools/list` describes it. */
export interface AgentMcpTool {
	name: string;
	description: string;
	/** JSON Schema of the arguments; MCP requires an object at the root. */
	inputSchema: Record<string, unknown>;
	annotations: { readOnlyHint: boolean };
}

/** The `/api/v1` endpoint a tool mirrors: a call runs exactly what a request to it runs. */
interface AgentMcpToolRoute {
	method: string;
	/** The path, with `{parameter}` placeholders. */
	path: string;
	pathParameters: readonly string[];
	idempotent: boolean;
	scope: AgentScope | null;
	operationKind: OperationKind | null;
}

interface AgentMcpToolDefinition {
	tool: AgentMcpTool;
	route: AgentMcpToolRoute;
	execute: ToolExecutor;
}

interface ToolCall {
	token: AuthenticatedAccessToken;
	name: string;
	pathParameters: Readonly<Record<string, string>>;
	body: Record<string, unknown>;
	imageBucket: AgentImageBucket | undefined;
}

type ToolExecutor = (call: ToolCall) => Promise<AgentApiResponse>;

type FixedOperationId = Exclude<
	(typeof AGENT_API_OPERATION_ID)[keyof typeof AGENT_API_OPERATION_ID],
	typeof AGENT_API_OPERATION_ID.openApiDocument
>;

function requiredPathParameter(call: ToolCall, name: string): string {
	const value = call.pathParameters[name];
	if (value === undefined) {
		throw new Error(`Missing path parameter ${name}`);
	}
	return value;
}

const FIXED_TOOL_EXECUTORS = {
	me: async ({ token }) => meResponse(token),
	listWishlists: ({ token }) => wishlistsResponse(token),
	submitChangeProposal: ({ token, body }) => proposalSubmissionResponse(token, body),
	getChangeProposal: (call) =>
		proposalResponse(call.token, requiredPathParameter(call, 'proposalId')),
	uploadImage: ({ token, body, imageBucket }) => imageUploadResponse(token, body, imageBucket),
} satisfies Record<FixedOperationId, ToolExecutor>;

function isFixedOperationId(operationId: string): operationId is FixedOperationId {
	return Object.hasOwn(FIXED_TOOL_EXECUTORS, operationId);
}

/** Operations run like their endpoint, except that a change is submitted as its own proposal. */
const OPERATION_TOOL_EXECUTORS = {
	[OPERATION_KIND.read]: ({ token, name, body }) => operationReadResponse(token, name, body),
	[OPERATION_KIND.mutation]: ({ token, name, body }) =>
		singleChangeSubmissionResponse(token, name, body),
} satisfies Record<OperationKind, ToolExecutor>;

const CONFIRMATION_NOTES: Readonly<Record<string, string>> = {
	always: ' It always waits for the user on the review page, even with fast-forward.',
	dependsOnInput: ' Some inputs wait for the user on the review page, even with fast-forward.',
};

function toolDescription(operation: DocumentedOperation): string {
	if (operation['x-operation-kind'] === OPERATION_KIND.mutation) {
		const confirmationNote = CONFIRMATION_NOTES[operation['x-confirmation'] ?? ''] ?? '';
		return `${operation.summary} Submits the change as a proposal of its own and answers it with its \`reviewUrl\`, where the user reviews and applies it; a fast-forward token applies it at once.${confirmationNote} Several changes to one wishlist belong in one ${AGENT_API_OPERATION_ID.submitChangeProposal} call instead.`;
	}
	if (operation['x-operation-kind'] === OPERATION_KIND.read) {
		return operation.summary;
	}
	return [operation.summary, operation.description].filter(Boolean).join(' ');
}

function argumentName(parameter: NonNullable<DocumentedOperation['parameters']>[number]): string {
	if (parameter.in === PARAMETER_LOCATION.path) {
		return parameter.name;
	}
	const headerArgumentName = HEADER_ARGUMENT_NAMES[parameter.name];
	if (headerArgumentName === undefined) {
		throw new Error(`No MCP argument for header ${parameter.name}`);
	}
	return headerArgumentName;
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

/** The request body's schema, with the path and header parameters as further arguments. */
function toolInputSchema(operation: DocumentedOperation): Record<string, unknown> {
	const bodySchema = operation.requestBody?.content['application/json'].schema ?? {
		properties: {},
		additionalProperties: false,
	};
	const parameters = operation.parameters ?? [];
	if (parameters.length === 0) {
		return { type: 'object', ...bodySchema };
	}
	const bodyProperties = v.parse(JsonObjectSchema, bodySchema.properties ?? {});
	const parameterProperties = Object.fromEntries(
		parameters.map((parameter) => [
			argumentName(parameter),
			parameter.description === undefined
				? parameter.schema
				: { ...parameter.schema, description: parameter.description },
		]),
	);
	return {
		...bodySchema,
		type: 'object',
		properties: { ...parameterProperties, ...bodyProperties },
		required: [
			...parameters
				.filter((parameter) => parameter.required === true)
				.map((parameter) => argumentName(parameter)),
			...stringList(bodySchema.required),
		],
	};
}

function toolDefinition(
	method: string,
	path: string,
	operation: DocumentedOperation,
): AgentMcpToolDefinition {
	const operationKind = operation['x-operation-kind'] ?? null;
	let execute: ToolExecutor;
	if (operationKind !== null) {
		execute = OPERATION_TOOL_EXECUTORS[operationKind];
	} else if (isFixedOperationId(operation.operationId)) {
		execute = FIXED_TOOL_EXECUTORS[operation.operationId];
	} else {
		throw new Error(`No MCP tool runs ${operation.operationId}`);
	}
	const parameters = operation.parameters ?? [];
	return {
		execute,
		tool: {
			name: operation.operationId,
			description: toolDescription(operation),
			inputSchema: toolInputSchema(operation),
			annotations: {
				readOnlyHint: method === 'get' || operationKind === OPERATION_KIND.read,
			},
		},
		route: {
			method: method.toUpperCase(),
			path,
			pathParameters: parameters
				.filter((parameter) => parameter.in === PARAMETER_LOCATION.path)
				.map((parameter) => parameter.name),
			idempotent: parameters.some(
				(parameter) => argumentName(parameter) === IDEMPOTENCY_KEY_ARGUMENT,
			),
			scope: operation['x-scope'] ?? null,
			operationKind,
		},
	};
}

/**
 * One tool per documented endpoint, read from the OpenAPI document itself, so a schema change
 * reaches the API docs and the MCP tools alike.
 */
function buildToolDefinitions(): Map<string, AgentMcpToolDefinition> {
	const document = buildAgentApiDocument('');
	const definitions = new Map<string, AgentMcpToolDefinition>();
	for (const [path, pathItem] of Object.entries(document.paths)) {
		for (const [method, documented] of Object.entries(pathItem)) {
			const operation = v.parse(DocumentedOperationSchema, documented);
			if (operation.operationId !== AGENT_API_OPERATION_ID.openApiDocument) {
				definitions.set(operation.operationId, toolDefinition(method, path, operation));
			}
		}
	}
	return definitions;
}

let toolDefinitions: Map<string, AgentMcpToolDefinition> | undefined;

function agentMcpToolDefinitions(): Map<string, AgentMcpToolDefinition> {
	toolDefinitions ??= buildToolDefinitions();
	return toolDefinitions;
}

/** The tools the grant's scopes allow; the others would only answer `AGENT_SCOPE_MISSING`. */
export function listAgentMcpTools(grant: Pick<AgentAccessGrant, 'scopes'>): AgentMcpTool[] {
	return [...agentMcpToolDefinitions().values()]
		.filter(({ route }) => route.scope === null || hasAgentScope(grant, route.scope))
		.map(({ tool }) => tool);
}

export function isAgentMcpTool(name: string): boolean {
	return agentMcpToolDefinitions().has(name);
}

function invalidArguments(): AgentApiFailure {
	return new AgentApiFailure(400, SERVER_ERROR.INVALID_OPERATION_INPUT);
}

function concretePath(route: AgentMcpToolRoute, pathParameters: Record<string, string>): string {
	return route.path.replace(/\{(\w+)\}/g, (_placeholder, name: string) =>
		encodeURIComponent(pathParameters[name] ?? ''),
	);
}

/** Runs a tool as the request its endpoint would get: path and header arguments split off. */
export async function callAgentMcpTool(
	token: AuthenticatedAccessToken,
	name: string,
	toolArguments: Record<string, unknown>,
	imageBucket: AgentImageBucket | undefined,
): Promise<AgentApiResponse> {
	const definition = agentMcpToolDefinitions().get(name);
	if (definition === undefined) {
		throw new Error(`Unknown MCP tool ${name}`);
	}
	const { route } = definition;
	const pathParameters: Record<string, string> = {};
	const body: Record<string, unknown> = {};
	let idempotencyKey: string | null = null;
	for (const [argument, value] of Object.entries(toolArguments)) {
		if (route.pathParameters.includes(argument)) {
			if (typeof value !== 'string' || value === '') {
				throw invalidArguments();
			}
			pathParameters[argument] = value;
		} else if (route.idempotent && argument === IDEMPOTENCY_KEY_ARGUMENT) {
			if (typeof value !== 'string') {
				throw invalidArguments();
			}
			idempotencyKey = value;
		} else {
			body[argument] = value;
		}
	}
	if (route.pathParameters.some((parameter) => pathParameters[parameter] === undefined)) {
		throw invalidArguments();
	}
	const call: ToolCall = { token, name, pathParameters, body, imageBucket };
	if (!route.idempotent) {
		return definition.execute(call);
	}
	return runIdempotently(
		{
			tokenId: token.tokenId,
			key: idempotencyKey,
			method: route.method,
			path: concretePath(route, pathParameters),
			body,
		},
		() => definition.execute(call),
	);
}
