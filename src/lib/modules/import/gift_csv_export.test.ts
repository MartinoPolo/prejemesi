import { describe, it, expect } from 'vitest';
import { buildGiftCsv, giftCsvFilename, type ExportableGift } from './gift_csv_export.js';
import { parseTabular } from './parse_tabular.js';
import { detectColumns } from './detect_columns.js';
import { buildDraftRows } from './import_draft_builder.js';
import { GIFT_CURRENCIES } from '$lib/modules/gifts/types.js';

const GIFTS: ExportableGift[] = [
	{
		name: 'Kniha',
		description: 'Atomové návyky',
		links: [{ url: 'https://alza.cz/kniha' }],
		price: 299,
		currency: GIFT_CURRENCIES.CZK,
		categoryLabel: 'Knihy',
	},
	{
		name: 'Sluchátka',
		description: null,
		links: [{ url: 'https://alza.cz/a' }, { url: 'https://mall.cz/b' }],
		price: 8990,
		currency: GIFT_CURRENCIES.CZK,
		categoryLabel: 'Elektronika',
	},
];

describe('buildGiftCsv', () => {
	it('emits importer role labels as headers (name/notes/link/price), no reservation columns', () => {
		const csv = buildGiftCsv(GIFTS);
		const header = csv.split(/\r?\n/)[0].toLowerCase();
		// Gift-data columns only.
		expect(header).toContain('název');
		expect(header).toContain('poznámka');
		expect(header).toContain('odkaz');
		expect(header).toContain('cena');
		expect(header).toContain('kategorie');
		// Never any reservation/received state.
		for (const forbidden of ['rezerv', 'reserved', 'gifter', 'koupeno', 'bought', 'received']) {
			expect(header).not.toContain(forbidden);
		}
	});

	it('round-trips gift data back through the importer', () => {
		const csv = buildGiftCsv(GIFTS);
		const parsed = parseTabular(csv);
		const detection = detectColumns(parsed.rows);
		const dataRows = parsed.rows.slice(detection.dataStartIndex, detection.dataEndIndex);
		const drafts = buildDraftRows(dataRows, detection.columns, [
			{
				id: 'category-books',
				presetKey: 'books',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 0,
			},
			{
				id: 'category-electronics',
				presetKey: 'electronics',
				customLabel: null,
				color: '#2563EB',
				sortOrder: 1,
			},
		]);

		expect(drafts).toHaveLength(2);
		expect(drafts[0]).toMatchObject({
			name: 'Kniha',
			description: 'Atomové návyky',
			links: [{ url: 'https://alza.cz/kniha' }],
			price: 299,
			categoryId: 'category-books',
			currency: GIFT_CURRENCIES.CZK,
		});
		expect(drafts[1]).toMatchObject({
			name: 'Sluchátka',
			links: [{ url: 'https://alza.cz/a' }, { url: 'https://mall.cz/b' }],
			price: 8990,
			categoryId: 'category-electronics',
			currency: GIFT_CURRENCIES.CZK,
		});
	});
});

describe('giftCsvFilename', () => {
	it('slugifies the wishlist title (diacritics stripped) with a .csv suffix', () => {
		expect(giftCsvFilename('Vánoce 2026', 'abc123')).toBe('vanoce-2026.csv');
	});

	it('falls back to the short id when the title has no slug characters', () => {
		expect(giftCsvFilename('🎁', 'abc123')).toBe('abc123.csv');
	});
});
