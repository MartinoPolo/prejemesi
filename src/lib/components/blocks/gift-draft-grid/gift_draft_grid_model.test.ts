import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: () => 'row-id' });

const { collectDraftGridChange, createDraftGridRow, rowToDraft } =
	await import('./gift_draft_grid_model.js');

describe('draft grid image and quantity editing', () => {
	it('preserves parsed image URL and quantity through preview row editing', () => {
		const row = createDraftGridRow({
			name: 'Kniha',
			imageUrl: 'https://images.example.test/book.jpg',
			quantity: 2,
		});
		expect(row).toMatchObject({
			imageUrl: 'https://images.example.test/book.jpg',
			quantity: '2',
		});

		row.imageUrl = 'https://images.example.test/book-edited.jpg';
		row.quantity = '5';
		expect(rowToDraft(row)).toMatchObject({
			imageUrl: 'https://images.example.test/book-edited.jpg',
			quantity: 5,
		});
	});
});

describe('draft grid price editing', () => {
	it('preserves a decimal price when converting an editor row to a draft', () => {
		const row = createDraftGridRow({ name: 'Kniha', price: 19.5 });

		expect(rowToDraft(row).price).toBe(19.5);
	});

	it.each(['1.001', 'Infinity', '10000000000'])(
		'blocks invalid manual price %s before submission',
		(price) => {
			const row = createDraftGridRow({ name: 'Kniha' });
			row.price = price;

			expect(collectDraftGridChange([row], () => false)).toMatchObject({
				validCount: 0,
				selectedCount: 1,
				blockingCount: 1,
			});
		},
	);

	it('keeps a valid two-decimal manual price committable', () => {
		const row = createDraftGridRow({ name: 'Kniha' });
		row.price = '19.99';

		expect(collectDraftGridChange([row], () => false)).toMatchObject({
			drafts: [{ price: 19.99 }],
			validCount: 1,
			blockingCount: 0,
		});
	});
});

describe('draft grid submission gate', () => {
	it('blocks a mixed selected valid and invalid batch until correction or deselection', () => {
		const valid = createDraftGridRow({ name: 'Kniha' });
		const invalid = createDraftGridRow({ name: 'Hrnek', quantity: 0 });

		expect(collectDraftGridChange([valid, invalid], () => false)).toMatchObject({
			validCount: 1,
			selectedCount: 2,
			blockingCount: 1,
		});

		invalid.selected = false;
		expect(collectDraftGridChange([valid, invalid], () => false)).toMatchObject({
			validCount: 1,
			selectedCount: 1,
			blockingCount: 0,
		});

		invalid.selected = true;
		invalid.quantity = '2';
		expect(collectDraftGridChange([valid, invalid], () => false)).toMatchObject({
			validCount: 2,
			selectedCount: 2,
			blockingCount: 0,
		});
	});

	it('requires duplicate dismissal only while the duplicate row is selected', () => {
		const duplicate = createDraftGridRow({ name: 'Stejný hrnek' });
		const hasDuplicateWarning = () => true;

		expect(collectDraftGridChange([duplicate], hasDuplicateWarning)).toMatchObject({
			drafts: [],
			validCount: 0,
			selectedCount: 1,
			blockingCount: 1,
		});

		duplicate.dismissedDuplicate = true;
		expect(collectDraftGridChange([duplicate], hasDuplicateWarning)).toMatchObject({
			validCount: 1,
			selectedCount: 1,
			blockingCount: 0,
		});

		duplicate.dismissedDuplicate = false;
		duplicate.selected = false;
		expect(collectDraftGridChange([duplicate], hasDuplicateWarning)).toMatchObject({
			drafts: [],
			validCount: 0,
			selectedCount: 0,
			blockingCount: 0,
		});
	});
});
