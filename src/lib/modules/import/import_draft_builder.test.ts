import { describe, it, expect } from 'vitest';
import { buildDraftRows } from './import_draft_builder.js';
import { COLUMN_ROLE, type DetectedColumn } from '$lib/modules/import/detect_columns.js';
import { DEFAULT_DRAFT_PRIORITY, GIFT_CURRENCIES } from '$lib/modules/gifts/types.js';

function makeColumn(
	index: number,
	role: DetectedColumn['role'],
	headerLabel: string | null = null,
): DetectedColumn {
	return { index, role, headerLabel };
}

describe('buildDraftRows', () => {
	it('maps clean CSV rows with name/notes/url/price columns to GiftDraft[]', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.notes, 'Notes'),
			makeColumn(2, COLUMN_ROLE.url, 'Link'),
			makeColumn(3, COLUMN_ROLE.price, 'Price'),
		];
		const rows = [
			['Book', 'Atomové návyky', 'https://alza.cz/book', '299 Kč'],
			['Headphones', 'Sony WH-1000XM5', 'https://alza.cz/headphones', '8 990 Kč'],
		];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts).toHaveLength(2);
		expect(drafts[0]).toEqual({
			name: 'Book',
			description: 'Atomové návyky',
			links: [{ url: 'https://alza.cz/book' }],
			price: 299,
			currency: GIFT_CURRENCIES.CZK,
			priority: DEFAULT_DRAFT_PRIORITY,
		});
		expect(drafts[1]).toEqual({
			name: 'Headphones',
			description: 'Sony WH-1000XM5',
			links: [{ url: 'https://alza.cz/headphones' }],
			price: 8990,
			currency: GIFT_CURRENCIES.CZK,
			priority: DEFAULT_DRAFT_PRIORITY,
		});
	});

	it('produces empty name when no name column has a value', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.url, 'Link'),
		];
		const rows = [['', 'https://example.com']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0].name).toBe('');
	});

	it('collects URLs from multiple url columns into links[]', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.url, 'Link 1'),
			makeColumn(2, COLUMN_ROLE.url, 'Link 2'),
		];
		const rows = [['Gift', 'https://alza.cz', 'https://mall.cz']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0].links).toEqual([{ url: 'https://alza.cz' }, { url: 'https://mall.cz' }]);
	});

	it('parses price "1 299 Kč" correctly', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.price, 'Price'),
		];
		const rows = [['Gift', '1 299 Kč']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0].price).toBe(1299);
		expect(drafts[0].currency).toBe(GIFT_CURRENCIES.CZK);
	});

	it('does not include bool column values in any draft field', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.bool, 'Taken'),
			makeColumn(2, COLUMN_ROLE.notes, 'Notes'),
		];
		const rows = [['Gift', 'Ano', 'Some note']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0]).toEqual({
			name: 'Gift',
			description: 'Some note',
			links: [],
			price: null,
			currency: GIFT_CURRENCIES.CZK,
			priority: DEFAULT_DRAFT_PRIORITY,
		});
	});

	it('ignores columns with role "ignore"', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.ignore, 'Junk'),
		];
		const rows = [['Gift', 'random data']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0]).toEqual({
			name: 'Gift',
			description: null,
			links: [],
			price: null,
			currency: GIFT_CURRENCIES.CZK,
			priority: DEFAULT_DRAFT_PRIORITY,
		});
	});

	it('skips empty url cells in links', () => {
		const columns: DetectedColumn[] = [
			makeColumn(0, COLUMN_ROLE.name, 'Name'),
			makeColumn(1, COLUMN_ROLE.url, 'Link'),
		];
		const rows = [['Gift', '']];

		const drafts = buildDraftRows(rows, columns);

		expect(drafts[0].links).toEqual([]);
	});
});
