import { describe, expect, it } from 'vitest';
import * as giftBulkOperations from './gift_bulk_operations.js';
import * as giftGroupingOperations from './gift_grouping_operations.js';
import * as giftMutationOperations from './gift_mutation_operations.js';
import * as giftReadOperations from './gift_read_operations.js';
import * as giftUndoOperations from './gift_undo_operations.js';
import * as importOperations from './import_operations.js';
import * as wishlistDetailOperations from './wishlist_detail_operations.js';
import * as wishlistLifecycleOperations from './wishlist_lifecycle_operations.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from './operation.js';
import { OPERATION_REGISTRY } from './registry.js';

const operationModules = [
	giftReadOperations,
	giftMutationOperations,
	giftBulkOperations,
	giftUndoOperations,
	giftGroupingOperations,
	importOperations,
	wishlistDetailOperations,
	wishlistLifecycleOperations,
];

describe('operation registry', () => {
	it('registers every operation under its own name', () => {
		for (const [name, operation] of Object.entries(OPERATION_REGISTRY)) {
			expect(operation.name).toBe(name);
		}
	});

	it('gives every operation a kind, an exposure and a validating input schema', () => {
		for (const operation of Object.values(OPERATION_REGISTRY)) {
			expect(Object.values(OPERATION_KIND)).toContain(operation.kind);
			expect(Object.values(OPERATION_EXPOSURE)).toContain(operation.exposure);
			expect(operation.input).toHaveProperty('~standard');
		}
	});

	it('keeps sharing, reverting, archiving, deleting and the recipient flip with the human user', () => {
		const humanOnlyNames = Object.values(OPERATION_REGISTRY)
			.filter((operation) => operation.exposure === OPERATION_EXPOSURE.humanOnly)
			.map((operation) => operation.name)
			.sort();
		expect(humanOnlyNames).toEqual(
			[
				'archiveWishlist',
				'deleteWishlist',
				'flipRecipientToFreeText',
				'revertWishlistToDraft',
				'shareWishlist',
			].sort(),
		);
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
