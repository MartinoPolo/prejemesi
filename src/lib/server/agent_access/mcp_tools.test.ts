import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENT_SCOPE } from '$lib/modules/access_tokens/scopes.js';
import { OPERATION_REGISTRY } from '$lib/server/operations/registry.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from '$lib/server/operations/operation.js';
import { buildAgentApiDocument } from './openapi.js';
import type * as OpenApiModule from './openapi.js';
import { listAgentMcpTools } from './mcp_tools.js';

const OPERATION_PATH_PREFIX = '/api/v1/operations/';
const EVERY_SCOPE = { scopes: Object.values(AGENT_SCOPE) };
const READ_ONLY = { scopes: [AGENT_SCOPE.read] };

const DocumentedEndpointSchema = v.object({
	operationId: v.string(),
	parameters: v.optional(
		v.array(v.object({ name: v.string(), in: v.string(), required: v.optional(v.boolean()) })),
	),
	requestBody: v.optional(
		v.object({
			content: v.object({
				'application/json': v.object({ schema: v.record(v.string(), v.unknown()) }),
			}),
		}),
	),
});

const ObjectSchema = v.object({
	type: v.literal('object'),
	properties: v.optional(v.record(v.string(), v.unknown())),
	required: v.optional(v.array(v.string())),
});

function documentedEndpoints() {
	const document = buildAgentApiDocument('https://prejemesi.cz');
	return Object.entries(document.paths).flatMap(([path, pathItem]) =>
		Object.values(pathItem).map((endpoint) => ({
			path,
			...v.parse(DocumentedEndpointSchema, endpoint),
		})),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** The nested object itself, not a copy, so a test can change the document in place. */
function memberOf(value: unknown, key: string): Record<string, unknown> {
	const member = isRecord(value) ? value[key] : undefined;
	if (!isRecord(member)) {
		throw new Error(`No object at ${key}`);
	}
	return member;
}

function toolNamed(name: string, grant = EVERY_SCOPE) {
	const tool = listAgentMcpTools(grant).find((candidate) => candidate.name === name);
	if (tool === undefined) {
		throw new Error(`No tool ${name}`);
	}
	return tool;
}

const agentOperations = Object.values(OPERATION_REGISTRY).filter(
	(operation) => operation.exposure === OPERATION_EXPOSURE.agent,
);

describe('MCP tools', () => {
	afterEach(() => {
		vi.doUnmock('./openapi.js');
		vi.resetModules();
	});

	it('are exactly the documented API endpoints, by the same names', () => {
		const documentedNames = documentedEndpoints()
			.map((endpoint) => endpoint.operationId)
			.filter((name) => name !== 'openApiDocument');

		expect(
			listAgentMcpTools(EVERY_SCOPE)
				.map((tool) => tool.name)
				.sort(),
		).toEqual(documentedNames.sort());
		for (const operation of agentOperations) {
			expect(documentedNames).toContain(operation.name);
		}
	});

	it('take each operation’s documented input schema as their arguments', () => {
		for (const endpoint of documentedEndpoints()) {
			if (!endpoint.path.startsWith(OPERATION_PATH_PREFIX)) {
				continue;
			}
			const documentedSchema = endpoint.requestBody?.content['application/json'].schema;
			expect(toolNamed(endpoint.operationId).inputSchema, endpoint.operationId).toEqual({
				type: 'object',
				...documentedSchema,
			});
		}
	});

	it('take path and Idempotency-Key parameters beside the documented request body', () => {
		const proposalBody = documentedEndpoints().find(
			(endpoint) => endpoint.operationId === 'submitChangeProposal',
		)?.requestBody?.content['application/json'].schema;
		const submitSchema = v.parse(ObjectSchema, toolNamed('submitChangeProposal').inputSchema);
		const bodyProperties = v.parse(ObjectSchema, {
			type: 'object',
			...proposalBody,
		}).properties;

		expect(submitSchema.properties).toEqual({
			idempotencyKey: expect.objectContaining({ type: 'string', maxLength: 255 }),
			...bodyProperties,
		});
		expect(submitSchema.required).toEqual(['operations']);
		expect(toolNamed('uploadImage').inputSchema).toMatchObject({
			properties: { idempotencyKey: { type: 'string' }, url: { type: 'string' } },
			required: ['url'],
		});
		expect(toolNamed('getChangeProposal').inputSchema).toMatchObject({
			type: 'object',
			properties: { proposalId: { type: 'string' } },
			required: ['proposalId'],
		});
	});

	it('follow a change to the documented schemas, since they are built from the document', async () => {
		vi.doMock('./openapi.js', async (importOriginal) => {
			const original = await importOriginal<typeof OpenApiModule>();
			return {
				...original,
				buildAgentApiDocument: (origin: string) => {
					const document = structuredClone(original.buildAgentApiDocument(origin));
					const createGiftProperties = [
						`${OPERATION_PATH_PREFIX}createGift`,
						'post',
						'requestBody',
						'content',
						'application/json',
						'schema',
						'properties',
					].reduce(memberOf, document.paths);
					createGiftProperties.addedField = { type: 'string' };
					return document;
				},
			};
		});
		const { listAgentMcpTools: listChangedTools } = await import('./mcp_tools.js');
		const createGift = listChangedTools(EVERY_SCOPE).find((tool) => tool.name === 'createGift');

		expect(createGift?.inputSchema).toMatchObject({
			properties: { addedField: { type: 'string' } },
		});
	});

	it('have an object schema at the root, as MCP requires', () => {
		for (const tool of listAgentMcpTools(EVERY_SCOPE)) {
			expect(tool.inputSchema, tool.name).toMatchObject({ type: 'object' });
		}
	});

	it('list only what the token scopes allow', () => {
		const readOnlyNames = listAgentMcpTools(READ_ONLY).map((tool) => tool.name);
		const readOperationNames = agentOperations
			.filter((operation) => operation.kind === OPERATION_KIND.read)
			.map((operation) => operation.name);

		expect(readOnlyNames).toEqual(expect.arrayContaining(readOperationNames));
		expect(readOnlyNames).toEqual(
			expect.arrayContaining(['me', 'listWishlists', 'getChangeProposal']),
		);
		expect(readOnlyNames).not.toContain('createGift');
		expect(readOnlyNames).not.toContain('uploadImage');
		expect(
			listAgentMcpTools({ scopes: [AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite] }).map(
				(tool) => tool.name,
			),
		).not.toContain('reserveGift');
	});

	it('mark reads read-only and describe changes as reviewed proposals', () => {
		expect(toolNamed('readWishlistGifts').annotations.readOnlyHint).toBe(true);
		expect(toolNamed('createGift').annotations.readOnlyHint).toBe(false);
		expect(toolNamed('createGift').description).toContain('reviewUrl');
		expect(toolNamed('deleteGift').description).toContain('always waits for the user');
	});
});
