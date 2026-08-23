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

		expect(collectDraftGridChange([duplicate], hasDuplicateWarning)).toEqual({
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
		expect(collectDraftGridChange([duplicate], hasDuplicateWarning)).toEqual({
			drafts: [],
			validCount: 0,
			selectedCount: 0,
			blockingCount: 0,
		});
	});
});
