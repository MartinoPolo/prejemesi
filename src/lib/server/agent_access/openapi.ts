import { toJsonSchema } from '@valibot/to-json-schema';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_KIND, type AnyOperation } from '$lib/server/operations/operation.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';
import { ALLOWED_CONTENT_TYPES, MAX_GIFT_IMAGE_BYTES } from '$lib/modules/uploads/types.js';
import {
	AGENT_OPERATION_POLICIES,
	isOperationName,
	type AgentOperationPolicy,
} from './operation_policies.js';
import {
	CHANGE_KIND,
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
} from '$lib/modules/change_proposals/types.js';
import {
	AGENT_API_MAX_BODY_BYTES,
	AGENT_API_RATE_LIMIT,
	AGENT_BATCH_MAX_ITEMS,
	AGENT_DAILY_CHANGE_BUDGET,
	AGENT_DAILY_IMAGE_BUDGET,
	AGENT_IMAGE_MAX_REDIRECTS,
	AGENT_IMAGE_REFERENCE_LIFETIME_MS,
	CHANGE_PROPOSAL_LIFETIME_MS,
	IDEMPOTENCY_KEY_RETENTION_MS,
} from './limits.js';
import { MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE_PX } from '$lib/server/images/image_download.js';
import { IMAGE_REFERENCE_FIELD } from './image_references.js';
import { AGENT_API_BASE_PATH } from './api_paths.js';
import { DAY_MS } from '$lib/server/operations/constants.js';
import { IDEMPOTENCY_KEY_MAX_LENGTH } from './idempotency.js';

const HOUR_MS = DAY_MS / 24;

/**
 * The documented endpoints besides the operations, which are documented under their own names.
 * MCP tools carry the same names.
 */
export const AGENT_API_OPERATION_ID = {
	me: 'me',
	listWishlists: 'listWishlists',
	submitChangeProposal: 'submitChangeProposal',
	getChangeProposal: 'getChangeProposal',
	uploadImage: 'uploadImage',
	openApiDocument: 'openApiDocument',
} as const;

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

const AGENT_IMAGE_INPUT_FIELDS = new Set(['imageUrl', 'imageKey']);

const IMAGE_REFERENCE_PROPERTY = {
	type: 'string',
	minLength: 1,
	description: `The \`reference\` of an image from POST ${AGENT_API_BASE_PATH}/images for the wishlist this changes. The gift gets the stored copy with automatic framing unless \`imageMeta\` is given; a reference attaches to one gift, once. Image URLs and storage keys are not accepted.`,
};

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An agent's input schema: where a gift image is set, by image reference only. */
function agentInputJsonSchema(
	operation: AnyOperation,
	policy: AgentOperationPolicy<unknown, unknown>,
): Record<string, unknown> {
	const schema = inputJsonSchema(operation);
	if (!policy.acceptsImageReference || !isJsonObject(schema.properties)) {
		return schema;
	}
	const properties = Object.fromEntries(
		Object.entries(schema.properties).filter(([field]) => !AGENT_IMAGE_INPUT_FIELDS.has(field)),
	);
	return {
		...schema,
		properties: { ...properties, [IMAGE_REFERENCE_FIELD]: IMAGE_REFERENCE_PROPERTY },
	};
}

function jsonResponse(description: string, schema: Record<string, unknown>) {
	return { description, content: { 'application/json': { schema } } };
}

function operationDescription(operation: AnyOperation): string {
	return operation.kind === OPERATION_KIND.read
		? 'Runs the read as the token user, within the token scopes and wishlist restriction.'
		: `A change. Changes are submitted as rows of POST ${AGENT_API_BASE_PATH}/proposals for the user to review; this endpoint answers 409 ${SERVER_ERROR.AGENT_MUTATION_REQUIRES_PROPOSAL}.`;
}

function agentMutationNames(): string[] {
	return Object.entries(OPERATION_REGISTRY)
		.filter(
			([name, operation]) =>
				operation.kind === OPERATION_KIND.mutation &&
				isOperationName(name) &&
				AGENT_OPERATION_POLICIES[name] !== null,
		)
		.map(([name]) => name);
}

const IDEMPOTENCY_KEY_PARAMETER = {
	name: 'Idempotency-Key',
	in: 'header',
	required: false,
	description: `Makes a retry safe: a request repeating a key and body within ${IDEMPOTENCY_KEY_RETENTION_MS / HOUR_MS} hours replays the first success (header \`Idempotent-Replayed: true\`) instead of changing anything again. The same key with a different request answers 422 ${SERVER_ERROR.AGENT_IDEMPOTENCY_KEY_REUSED}; while the first request still runs, 409 ${SERVER_ERROR.AGENT_IDEMPOTENCY_IN_PROGRESS}. A failed request frees its key.`,
	schema: {
		type: 'string',
		minLength: 1,
		maxLength: IDEMPOTENCY_KEY_MAX_LENGTH,
		pattern: '^[\\x21-\\x7E]+$',
	},
};

const CHANGE_PROPOSAL_REQUEST_SCHEMA = {
	type: 'object',
	required: ['operations'],
	additionalProperties: false,
	description:
		'Names at most one wishlist, by `wishlistShortId` or `wishlistId`; every row must change it. Only a proposal of an unrestricted fast-forward token may name none, and then lists only `createWishlist` and `createWishlistFromImport` rows. Rows cannot refer to ids an earlier row creates.',
	properties: {
		wishlistShortId: { type: 'string' },
		wishlistId: { type: 'string' },
		operations: {
			type: 'array',
			minItems: 1,
			maxItems: AGENT_BATCH_MAX_ITEMS,
			items: {
				type: 'object',
				required: ['operation', 'input'],
				additionalProperties: false,
				properties: {
					operation: { type: 'string', enum: agentMutationNames() },
					input: {
						type: 'object',
						description: `The input of POST ${AGENT_API_BASE_PATH}/operations/{operation}.`,
					},
				},
			},
		},
	},
};

const CHANGE_PROPOSAL_SCHEMA = {
	type: 'object',
	required: ['id', 'status', 'reviewUrl', 'expiresAt', 'rows'],
	properties: {
		id: { type: 'string' },
		status: { type: 'string', enum: Object.values(CHANGE_PROPOSAL_STATE) },
		wishlistShortId: { type: ['string', 'null'] },
		reviewUrl: {
			type: ['string', 'null'],
			description:
				'The path of the review page, `/w/{shortId}/changes/{id}`, to show the user.',
		},
		createdAt: { type: 'string', format: 'date-time' },
		expiresAt: { type: 'string', format: 'date-time' },
		appliedAt: { type: ['string', 'null'], format: 'date-time' },
		discardedAt: { type: ['string', 'null'], format: 'date-time' },
		undoneAt: { type: ['string', 'null'], format: 'date-time' },
		rows: {
			type: 'array',
			items: {
				type: 'object',
				required: ['rowId', 'operation', 'kind', 'status', 'requiresConfirmation'],
				properties: {
					rowId: { type: 'string', examples: ['r1'] },
					operation: { type: 'string' },
					kind: { type: 'string', enum: Object.values(CHANGE_KIND) },
					status: { type: 'string', enum: Object.values(CHANGE_ROW_STATUS) },
					requiresConfirmation: { type: 'boolean' },
					error: {
						type: ['object', 'null'],
						description:
							'Why the dry run rejected the row: `status`, `code`, `details`.',
					},
					conflictGiftIds: {
						type: 'array',
						items: { type: 'string' },
						description: 'Gifts the row targets that changed since submission.',
					},
					result: {
						description:
							'The applied row’s projected output; before apply, the dry run’s, whose created ids are not real.',
					},
				},
			},
		},
	},
};

const CHANGE_PROPOSAL_RESPONSE_SCHEMA = {
	type: 'object',
	required: ['proposal'],
	properties: { proposal: { $ref: '#/components/schemas/ChangeProposal' } },
};

function changeProposalPaths() {
	return {
		[`${AGENT_API_BASE_PATH}/proposals`]: {
			post: {
				operationId: AGENT_API_OPERATION_ID.submitChangeProposal,
				summary: 'Submits changes for the user to review.',
				description: `Authorizes every row with the token, dry-runs the rows and stores the proposal for ${CHANGE_PROPOSAL_LIFETIME_MS / DAY_MS} days; the user reviews it at \`reviewUrl\` and applies any rows. With a fast-forward token, a proposal whose rows are all \`ready\` applies at once; gift deletions, reservations and manager invitations always wait for the user. Rows count against the daily change budget whatever their outcome.`,
				parameters: [IDEMPOTENCY_KEY_PARAMETER],
				requestBody: {
					required: true,
					content: { 'application/json': { schema: CHANGE_PROPOSAL_REQUEST_SCHEMA } },
				},
				responses: {
					201: jsonResponse('The stored proposal.', CHANGE_PROPOSAL_RESPONSE_SCHEMA),
					...OPERATION_ERROR_RESPONSES,
					422: ERROR_RESPONSE_REFERENCE,
				},
			},
		},
		[`${AGENT_API_BASE_PATH}/proposals/{proposalId}`]: {
			get: {
				operationId: AGENT_API_OPERATION_ID.getChangeProposal,
				summary: 'A proposal of the token user, with its current status.',
				parameters: [
					{ name: 'proposalId', in: 'path', required: true, schema: { type: 'string' } },
				],
				responses: {
					200: jsonResponse('The proposal.', CHANGE_PROPOSAL_RESPONSE_SCHEMA),
					...AUTHENTICATED_ERROR_RESPONSES,
					404: ERROR_RESPONSE_REFERENCE,
				},
			},
		},
	};
}

const AGENT_IMAGE_REQUEST_SCHEMA = {
	type: 'object',
	required: ['url'],
	additionalProperties: false,
	description:
		'Names exactly one wishlist the token user manages, by `wishlistShortId` or `wishlistId`.',
	properties: {
		wishlistShortId: { type: 'string' },
		wishlistId: { type: 'string' },
		url: { type: 'string', format: 'uri', maxLength: 2048 },
	},
};

const AGENT_IMAGE_RESPONSE_SCHEMA = {
	type: 'object',
	required: ['image'],
	properties: {
		image: {
			type: 'object',
			required: [
				'reference',
				'url',
				'contentType',
				'byteLength',
				'width',
				'height',
				'expiresAt',
			],
			properties: {
				reference: {
					type: 'string',
					description: `Set as \`${IMAGE_REFERENCE_FIELD}\` in a createGift or updateGift row.`,
				},
				url: { type: 'string', description: 'Where the stored copy is served.' },
				contentType: { type: 'string', enum: [...ALLOWED_CONTENT_TYPES] },
				byteLength: { type: 'integer' },
				width: { type: 'integer' },
				height: { type: 'integer' },
				expiresAt: {
					type: 'string',
					format: 'date-time',
					description: 'The reference must be attached by an applied change before this.',
				},
			},
		},
	},
};

function agentImagePaths() {
	return {
		[`${AGENT_API_BASE_PATH}/images`]: {
			post: {
				operationId: AGENT_API_OPERATION_ID.uploadImage,
				summary: 'Stores an image from a public HTTPS URL for a gift.',
				description: `Needs \`${AGENT_SCOPE.giftsWrite}\`. Downloads the image server-side and stores a copy; the URL itself is never kept. Every hop, including at most ${AGENT_IMAGE_MAX_REDIRECTS} redirects, must be HTTPS on the default port to a public host name: IP addresses and local names answer 400 ${SERVER_ERROR.AGENT_IMAGE_HOST_BLOCKED}. The image must be ${ALLOWED_CONTENT_TYPES.join(', ')} whose bytes match the declared type, at most ${MAX_GIFT_IMAGE_BYTES} bytes, with positive dimensions of at most ${MAX_IMAGE_SIDE_PX} px per side and ${MAX_IMAGE_PIXELS} pixels (422). The reference is valid for ${AGENT_IMAGE_REFERENCE_LIFETIME_MS / DAY_MS} days, for the token user on this wishlist; an unattached image is then deleted. Counts against the daily image budget.`,
				'x-scope': AGENT_SCOPE.giftsWrite,
				parameters: [IDEMPOTENCY_KEY_PARAMETER],
				requestBody: {
					required: true,
					content: { 'application/json': { schema: AGENT_IMAGE_REQUEST_SCHEMA } },
				},
				responses: {
					201: jsonResponse(
						'The stored image and its reference.',
						AGENT_IMAGE_RESPONSE_SCHEMA,
					),
					...OPERATION_ERROR_RESPONSES,
					422: ERROR_RESPONSE_REFERENCE,
					502: ERROR_RESPONSE_REFERENCE,
				},
			},
		},
	};
}

function operationPath(operation: AnyOperation, policy: AgentOperationPolicy<unknown, unknown>) {
	return {
		post: {
			operationId: operation.name,
			summary: policy.summary,
			description: operationDescription(operation),
			tags: [operation.kind],
			'x-scope': policy.scope,
			'x-operation-kind': operation.kind,
			'x-confirmation': policy.confirmationMode,
			requestBody: {
				required: true,
				content: {
					'application/json': { schema: agentInputJsonSchema(operation, policy) },
				},
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
				maxBytes: {
					type: 'integer',
					description: `With ${SERVER_ERROR.AGENT_REQUEST_TOO_LARGE} and ${SERVER_ERROR.AGENT_IMAGE_TOO_LARGE}.`,
				},
				rowId: {
					type: 'string',
					description: 'The proposal row a submission error is about.',
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
				`Limits: ${AGENT_API_RATE_LIMIT.requestsPerToken} requests per ${AGENT_API_RATE_LIMIT.periodSeconds} seconds per token (429 with Retry-After), ${AGENT_BATCH_MAX_ITEMS} items per batch, ${AGENT_API_MAX_BODY_BYTES} bytes per request body, ${AGENT_DAILY_CHANGE_BUDGET.rows} proposal rows per user over the trailing ${AGENT_DAILY_CHANGE_BUDGET.windowMs / HOUR_MS} hours across all tokens (429 ${SERVER_ERROR.AGENT_DAILY_CHANGE_BUDGET_EXCEEDED} with Retry-After), ${AGENT_DAILY_IMAGE_BUDGET.images} images per user over the trailing ${AGENT_DAILY_IMAGE_BUDGET.windowMs / HOUR_MS} hours across all tokens (429 ${SERVER_ERROR.AGENT_DAILY_IMAGE_BUDGET_EXCEEDED} with Retry-After).`,
				`Gift images: POST ${AGENT_API_BASE_PATH}/images stores an image from a URL, and a createGift or updateGift row sets it by \`${IMAGE_REFERENCE_FIELD}\`.`,
				`Changes are proposals: POST ${AGENT_API_BASE_PATH}/proposals, which the user reviews and applies.`,
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
			schemas: { Error: ERROR_SCHEMA, ChangeProposal: CHANGE_PROPOSAL_SCHEMA },
			responses: {
				Error: jsonResponse('The request failed.', { $ref: '#/components/schemas/Error' }),
			},
		},
		paths: {
			[`${AGENT_API_BASE_PATH}/me`]: {
				get: {
					operationId: AGENT_API_OPERATION_ID.me,
					summary: 'The token user and the token itself.',
					responses: {
						200: jsonResponse('The token user and token.', { type: 'object' }),
						...AUTHENTICATED_ERROR_RESPONSES,
					},
				},
			},
			[`${AGENT_API_BASE_PATH}/wishlists`]: {
				get: {
					operationId: AGENT_API_OPERATION_ID.listWishlists,
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
			...changeProposalPaths(),
			...agentImagePaths(),
			...agentOperationPaths(),
			[`${AGENT_API_BASE_PATH}/openapi.json`]: {
				get: {
					operationId: AGENT_API_OPERATION_ID.openApiDocument,
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
