import { describe, it, expect } from 'vitest';
import {
	createBlankDraft,
	getValidSelectedCount,
	getDraftStatus,
	isDirty,
	toGiftDraftInputs,
	type GridDraftRow,
} from './gift_draft_grid.js';
import { GIFT_CURRENCIES, DEFAULT_GIFT_CURRENCY } from '$lib/modules/gifts/types.js';

function makeRow(overrides: Partial<GridDraftRow> = {}): GridDraftRow {
	return {
		id: crypto.randomUUID(),
		draft: createBlankDraft(),
		selected: true,
		touched: false,
		...overrides,
	};
}

// ── 1. createBlankDraft ─────────────────────────────────────────────────────

describe('createBlankDraft', () => {
	it('returns a GiftDraft with empty name, null description, empty links, null price, CZK currency', () => {
		const blank = createBlankDraft();
		expect(blank.name).toBe('');
		expect(blank.description).toBeNull();
		expect(blank.links).toEqual([]);
		expect(blank.price).toBeNull();
		expect(blank.currency).toBe(DEFAULT_GIFT_CURRENCY);
	});
});

// ── 2-4. getValidSelectedCount ──────────────────────────────────────────────

describe('getValidSelectedCount', () => {
	it('returns count of drafts that have non-empty name AND are selected', () => {
		const rows: GridDraftRow[] = [
			makeRow({ draft: { ...createBlankDraft(), name: 'Gift A' } }),
			makeRow({ draft: { ...createBlankDraft(), name: 'Gift B' } }),
			makeRow({ draft: { ...createBlankDraft(), name: '' } }),
		];
		expect(getValidSelectedCount(rows)).toBe(2);
	});

	it('returns 0 when all rows have empty names', () => {
		const rows: GridDraftRow[] = [makeRow(), makeRow(), makeRow()];
		expect(getValidSelectedCount(rows)).toBe(0);
	});

	it('treats whitespace-only names as invalid', () => {
		const rows: GridDraftRow[] = [makeRow({ draft: { ...createBlankDraft(), name: '   ' } })];
		expect(getValidSelectedCount(rows)).toBe(0);
	});

	it('excludes deselected rows even if they have names', () => {
		const rows: GridDraftRow[] = [
			makeRow({ draft: { ...createBlankDraft(), name: 'Gift A' }, selected: false }),
			makeRow({ draft: { ...createBlankDraft(), name: 'Gift B' } }),
		];
		expect(getValidSelectedCount(rows)).toBe(1);
	});
});

// ── 5-8. getDraftStatus ─────────────────────────────────────────────────────

describe('getDraftStatus', () => {
	it("returns 'ready' for named+selected row", () => {
		const row = makeRow({ draft: { ...createBlankDraft(), name: 'Gift' } });
		expect(getDraftStatus(row)).toBe('ready');
	});

	it("returns 'error' for blank-name+selected+touched row", () => {
		const row = makeRow({ touched: true });
		expect(getDraftStatus(row)).toBe('error');
	});

	it("returns 'excluded' for deselected row", () => {
		const row = makeRow({ selected: false });
		expect(getDraftStatus(row)).toBe('excluded');
	});

	it("returns 'pristine' for blank-name+selected+NOT-touched row", () => {
		const row = makeRow();
		expect(getDraftStatus(row)).toBe('pristine');
	});
});

// ── 9-10. isDirty ───────────────────────────────────────────────────────────

describe('isDirty', () => {
	it('returns false when grid has only one blank untouched row', () => {
		const rows: GridDraftRow[] = [makeRow()];
		expect(isDirty(rows)).toBe(false);
	});

	it('returns true when name has been typed (isolates name branch)', () => {
		const rows: GridDraftRow[] = [
			makeRow({ draft: { ...createBlankDraft(), name: 'Something' }, touched: false }),
		];
		expect(isDirty(rows)).toBe(true);
	});

	it('returns true when row is touched but otherwise blank', () => {
		const rows: GridDraftRow[] = [makeRow({ touched: true })];
		expect(isDirty(rows)).toBe(true);
	});

	it('returns true when a link has been added (isolates links branch)', () => {
		const rows: GridDraftRow[] = [
			makeRow({
				draft: { ...createBlankDraft(), links: [{ url: 'https://example.com' }] },
				touched: false,
			}),
		];
		expect(isDirty(rows)).toBe(true);
	});

	it('returns true when there are multiple rows even if all blank', () => {
		const rows: GridDraftRow[] = [makeRow(), makeRow()];
		expect(isDirty(rows)).toBe(true);
	});
});

// ── 11-12. toGiftDraftInputs ────────────────────────────────────────────────

describe('toGiftDraftInputs', () => {
	it('maps valid selected GridDraftRow[] to GiftDraftInput[] (only valid+selected, trimmed)', () => {
		const rows: GridDraftRow[] = [
			makeRow({
				draft: {
					name: '  Gift A  ',
					description: '  A description  ',
					links: [{ url: 'https://example.com' }],
					price: 100,
					currency: GIFT_CURRENCIES.EUR,
				},
			}),
			makeRow({
				draft: {
					name: 'Gift B',
					description: null,
					links: [],
					price: null,
					currency: GIFT_CURRENCIES.CZK,
				},
			}),
		];

		const result = toGiftDraftInputs(rows);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			name: 'Gift A',
			description: 'A description',
			links: [{ url: 'https://example.com/' }], // normalizeGiftLinks adds trailing slash
			price: 100,
			currency: GIFT_CURRENCIES.EUR,
		});
		expect(result[1]).toEqual({
			name: 'Gift B',
			description: null,
			links: [],
			price: null,
			currency: GIFT_CURRENCIES.CZK,
		});
	});

	it('excludes deselected rows and invalid (blank name) rows', () => {
		const rows: GridDraftRow[] = [
			makeRow({
				draft: { ...createBlankDraft(), name: 'Valid' },
			}),
			makeRow({
				draft: { ...createBlankDraft(), name: 'Deselected' },
				selected: false,
			}),
			makeRow({
				draft: { ...createBlankDraft(), name: '' },
			}),
			makeRow({
				draft: { ...createBlankDraft(), name: '   ' },
			}),
		];

		const result = toGiftDraftInputs(rows);
		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe('Valid');
	});
});
