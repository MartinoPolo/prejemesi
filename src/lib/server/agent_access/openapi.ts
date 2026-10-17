import { toJsonSchema } from '@valibot/to-json-schema';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_KIND, type AnyOperation } from '$lib/server/operations/operation.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
} from './operation_policies.js';
import { AGENT_API_MAX_BODY_BYTES, AGENT_API_RATE_LIMIT, AGENT_BATCH_MAX_ITEMS } from './limits.js';
import { AGENT_API_BASE_PATH } from './api_paths.js';

const ERROR_RESPONSE_REFERENCE = { $ref: '#/components/responses/Error' } as const;

const AUTHENTICATED_ERROR_RESPONSES = {
	401: ERROR_RESPONSE_REFERENCE,
	403: ERROR_RESPONSE_REFERENCE,
	429: ERROR_RESPONSE_REFERENCE,
	503: ERROR_RESPONSE_REFERENCE,
};

const OPERATION_ERROR_RESPONSES = {
	...AUTHENTICATED_ERROR_RESPONSES,
	400: ERROR_RESPONSE_REFERENCE,
	404: ERROR_RESPONSE_REFERENCE,
	409: ERROR_RESPONSE_REFERENCE,
	413: ERROR_RESPONSE_REFERENCE,
	415: ERROR_RESPONSE_REFERENCE,
};

/** The JSON Schema of an operation's input; parts without an equivalent stay unconstrained. */
function inputJsonSchema(operation: AnyOperation): Record<string, unknown> {
	const schema: Record<string, unknown> = {
		...toJsonSchema(operation.input, {
			target: 'draft-2020-12',
			typeMode: 'input',
			errorMode: 'ignore',
		}),
	};
	// OpenAPI 3.1 documents declare the JSON Schema dialect once, not per schema.
	delete schema.$schema;
	return schema;
}

function jsonResponse(description: string, schema: Record<string, unknown>) {
	return { description, content: { 'application/json': { schema } } };
}

function operationDescription(operation: AnyOperation): string {
	return operation.kind === OPERATION_KIND.read
		? 'Runs the read as the token user, within the token scopes and wishlist restriction.'
		: `A change. Changes are submitted as proposals the user reviews; this endpoint answers 409 ${SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL}.`;
}

function operationPath(operation: AnyOperation, policy: AgentOperationPolicy<unknown, unknown>) {
	return {
		post: {
			operationId: operation.name,
			summary: operation.name,
			description: operationDescription(operation),
			tags: [operation.kind],
			'x-scope': policy.scope,
			'x-operation-kind': operation.kind,
			'x-confirmation': policy.confirmationMode,
			requestBody: {
				required: true,
				content: { 'application/json': { schema: inputJsonSchema(operation) } },
			},
			responses: {
				200: jsonResponse('The projected result.', {
					type: 'object',
					required: ['result'],
					properties: { result: {} },
				}),
				...OPERATION_ERROR_RESPONSES,
			},
		},
	};
}

function agentOperationPaths() {
	const paths: Record<string, ReturnType<typeof operationPath>> = {};
	for (const [name, operation] of Object.entries(OPERATION_REGISTRY)) {
		const policy = isOperationName(name) ? AGENT_OPERATION_POLICIES[name] : null;
		if (policy !== null) {
			paths[`${AGENT_API_BASE_PATH}/operations/${name}`] = operationPath(operation, policy);
		}
	}
	return paths;
}

const ERROR_SCHEMA = {
	type: 'object',
	required: ['error'],
	properties: {
		error: {
			type: 'object',
			required: ['code', 'message'],
			properties: {
				code: { type: 'string', examples: [SERVER_ERROR.AGENT_SCOPE_MISSING] },
				message: { type: 'string' },
				retryAfterSeconds: { type: 'integer', description: 'With 429.' },
				maxItems: {
					type: 'integer',
					description: `With ${SERVER_ERROR.AGENT_BATCH_TOO_LARGE}.`,
				},
			},
			additionalProperties: true,
		},
	},
};

function buildOriginIndependentDocument() {
	return {
		openapi: '3.1.0',
		info: {
			title: 'Přejeme si agent API',
			version: '1',
			description: [
				'Every call acts as the token user, with that user’s current rights, limited by the token scopes and wishlist restriction.',
				`Scopes: ${Object.values(AGENT_SCOPE).join(', ')}; \`read\` is always granted.`,
				`Limits: ${AGENT_API_RATE_LIMIT.requestsPerToken} requests per ${AGENT_API_RATE_LIMIT.periodSeconds} seconds per token (429 with Retry-After), ${AGENT_BATCH_MAX_ITEMS} items per batch, ${AGENT_API_MAX_BODY_BYTES} bytes per request body.`,
			].join('\n\n'),
		},
		security: [{ bearerAuth: [] }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: 'A personal access token (`pjs_…`) created in Settings.',
				},
			},
			schemas: { Error: ERROR_SCHEMA },
			responses: {
				Error: jsonResponse('The request failed.', { $ref: '#/components/schemas/Error' }),
			},
		},
		paths: {
			[`${AGENT_API_BASE_PATH}/me`]: {
				get: {
					operationId: 'me',
					summary: 'The token user and the token itself.',
					responses: {
						200: jsonResponse('The token user and token.', { type: 'object' }),
						...AUTHENTICATED_ERROR_RESPONSES,
					},
				},
			},
			[`${AGENT_API_BASE_PATH}/wishlists`]: {
				get: {
					operationId: 'listWishlists',
					summary: 'The wishlists the token reaches, with the user’s role on each.',
					'x-scope': AGENT_SCOPE.read,
					responses: {
						200: jsonResponse('The reachable wishlists.', {
							type: 'object',
							required: ['wishlists'],
							properties: { wishlists: { type: 'array', items: { type: 'object' } } },
						}),
						...AUTHENTICATED_ERROR_RESPONSES,
					},
				},
			},
			...agentOperationPaths(),
			[`${AGENT_API_BASE_PATH}/openapi.json`]: {
				get: {
					operationId: 'openApiDocument',
					summary: 'This document.',
					security: [],
					responses: { 200: jsonResponse('OpenAPI 3.1 document.', { type: 'object' }) },
				},
			},
		},
	};
}

let originIndependentDocument: ReturnType<typeof buildOriginIndependentDocument> | undefined;

/**
 * The agent API as OpenAPI 3.1, generated from the operation registry and agent policies so the
 * documentation lists exactly the operations a token may call.
 */
export function buildAgentApiDocument(serverOrigin: string) {
	originIndependentDocument ??= buildOriginIndependentDocument();
	return { ...originIndependentDocument, servers: [{ url: serverOrigin }] };
}
