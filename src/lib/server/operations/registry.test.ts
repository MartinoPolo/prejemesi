import { describe, expect, it } from 'vitest';
import * as giftBulkOperations from './gift_bulk_operations.js';
import * as giftMutationOperations from './gift_mutation_operations.js';
import * as giftReadOperations from './gift_read_operations.js';
import * as giftUndoOperations from './gift_undo_operations.js';
import { OPERATION_KIND } from './operation.js';
import { OPERATION_REGISTRY } from './registry.js';

const operationModules = [
	giftReadOperations,
	giftMutationOperations,
	giftBulkOperations,
	giftUndoOperations,
];

describe('operation registry', () => {
	it('registers every operation under its own name', () => {
		for (const [name, operation] of Object.entries(OPERATION_REGISTRY)) {
			expect(operation.name).toBe(name);
		}
	});

	it('gives every operation a kind and a validating input schema', () => {
		for (const operation of Object.values(OPERATION_REGISTRY)) {
			expect(Object.values(OPERATION_KIND)).toContain(operation.kind);
			expect(operation.input).toHaveProperty('~standard');
		}
	});

	it('contains every exported operation, so generated agent surfaces miss none', () => {
		const registered = new Set<unknown>(Object.values(OPERATION_REGISTRY));
		const exported = operationModules.flatMap((module) =>
			Object.entries(module)
				.filter(([exportName]) => exportName.endsWith('Operation'))
				.map(([, value]) => value),
		);
		expect(exported.length).toBeGreaterThan(0);
		for (const operation of exported) {
			expect(registered.has(operation)).toBe(true);
		}
	});
});
