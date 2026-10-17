import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from '$lib/server/operations/operation.js';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { buildAgentApiDocument } from './openapi.js';
import { AGENT_BATCH_MAX_ITEMS } from './limits.js';
import { GET as getOpenApiDocument } from '../../../routes/api/v1/openapi.json/+server.js';

const OPERATION_PATH_PREFIX = '/api/v1/operations/';
const DocumentedOperationPathSchema = v.object({
	post: v.object({
		'x-scope': v.string(),
		'x-confirmation': v.string(),
		requestBody: v.object({
			content: v.object({
				'application/json': v.object({ schema: v.record(v.string(), v.unknown()) }),
			}),
		}),
	}),
});
const document = buildAgentApiDocument('https://prejemesi.cz');
const operations = Object.values(OPERATION_REGISTRY);

function documentedOperationNames(): string[] {
	return Object.keys(document.paths)
		.filter((path) => path.startsWith(OPERATION_PATH_PREFIX))
		.map((path) => path.slice(OPERATION_PATH_PREFIX.length));
}

function documentedOperation(name: string) {
	const paths: Record<string, unknown> = document.paths;
	const path = paths[`${OPERATION_PATH_PREFIX}${name}`];
	if (path === undefined) {
		throw new Error(`${name} is not documented`);
	}
	return v.parse(DocumentedOperationPathSchema, path).post;
}

function documentedInputSchema(name: string) {
	return documentedOperation(name).requestBody.content['application/json'].schema;
}

describe('agent API document', () => {
	it('is served publicly as JSON, without a token', async () => {
		// The route reads only the request URL from its SvelteKit event.
		const serveDocument = getOpenApiDocument as unknown as (event: {
			url: URL;
		}) => Response | Promise<Response>;

		const response = await serveDocument({
			url: new URL('https://prejemesi.cz/api/v1/openapi.json'),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toMatchObject({
			openapi: '3.1.0',
			servers: [{ url: 'https://prejemesi.cz' }],
		});
	});

	it('is an OpenAPI 3.1 document authenticated by bearer tokens', () => {
		expect(document.openapi).toBe('3.1.0');
		expect(document.components.securitySchemes.bearerAuth).toMatchObject({
			type: 'http',
			scheme: 'bearer',
		});
		expect(document.security).toEqual([{ bearerAuth: [] }]);
	});

	it('lists every agent operation and no human-only one', () => {
		const agentOperationNames = operations
			.filter((operation) => operation.exposure === OPERATION_EXPOSURE.agent)
			.map((operation) => operation.name);
		const humanOnlyNames = operations
			.filter((operation) => operation.exposure === OPERATION_EXPOSURE.humanOnly)
			.map((operation) => operation.name);

		expect(documentedOperationNames().sort()).toEqual([...agentOperationNames].sort());
		expect(humanOnlyNames.length).toBeGreaterThan(0);
		const serialized = JSON.stringify(document);
		for (const humanOnlyName of humanOnlyNames) {
			expect(serialized).not.toContain(`"${humanOnlyName}"`);
		}
	});

	it('states each operation’s scope, confirmation and input schema', () => {
		for (const name of documentedOperationNames()) {
			const operation = documentedOperation(name);
			expect(Object.values(AGENT_SCOPE), name).toContain(operation['x-scope']);
			expect(['never', 'always', 'dependsOnInput'], name).toContain(
				operation['x-confirmation'],
			);
			expect(Object.keys(documentedInputSchema(name)), name).not.toHaveLength(0);
		}
		expect(documentedOperation('deleteGift')['x-confirmation']).toBe('always');
		expect(documentedOperation('readWishlist')['x-confirmation']).toBe('never');
		// Undo confirms only when it would delete a gift the undone change created.
		expect(documentedOperation('undoGiftRevision')['x-confirmation']).toBe('dependsOnInput');
		expect(documentedOperation('createGift')['x-scope']).toBe(AGENT_SCOPE.giftsWrite);
		expect(documentedInputSchema('createGift')).toMatchObject({
			properties: { wishlistId: { type: 'string' } },
		});
	});

	it('documents submitting proposals of agent changes, with an optional Idempotency-Key', () => {
		const mutationNames = operations
			.filter(
				(operation) =>
					operation.exposure === OPERATION_EXPOSURE.agent &&
					operation.kind === OPERATION_KIND.mutation,
			)
			.map((operation) => operation.name);

		expect(document.paths['/api/v1/proposals'].post).toMatchObject({
			parameters: [{ name: 'Idempotency-Key', in: 'header', required: false }],
			requestBody: {
				content: {
					'application/json': {
						schema: {
							required: ['operations'],
							properties: {
								operations: {
									maxItems: AGENT_BATCH_MAX_ITEMS,
									items: {
										properties: { operation: { enum: expect.any(Array) } },
									},
								},
							},
						},
					},
				},
			},
			responses: { 201: expect.anything(), 422: expect.anything(), 429: expect.anything() },
		});
		const documentedEnum =
			document.paths['/api/v1/proposals'].post.requestBody.content['application/json'].schema
				.properties.operations.items.properties.operation.enum;
		expect([...documentedEnum].sort()).toEqual([...mutationNames].sort());
		expect(document.paths['/api/v1/proposals/{proposalId}'].get.responses).toHaveProperty(
			'404',
		);
		expect(document.components.schemas.ChangeProposal).toMatchObject({
			properties: {
				id: expect.anything(),
				reviewUrl: expect.anything(),
				rows: expect.anything(),
			},
		});
	});

	it('describes the error shape every failure uses', () => {
		expect(document.components.schemas.Error).toMatchObject({
			required: ['error'],
			properties: { error: { required: ['code', 'message'] } },
		});
	});
});
