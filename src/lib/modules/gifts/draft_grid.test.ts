import { describe, expect, it } from 'vitest';
import { ROW_STATUS, deriveRowStatus, headerSelectionState } from './draft_grid.js';

describe('deriveRowStatus', () => {
	it('blank name on a touched row is an error', () => {
		expect(deriveRowStatus({ name: '', isDuplicate: false, pristine: false })).toBe(
			ROW_STATUS.error,
		);
	});

	it('whitespace-only name is an error', () => {
		expect(deriveRowStatus({ name: '   ', isDuplicate: false, pristine: false })).toBe(
			ROW_STATUS.error,
		);
	});

	it('blank name on a pristine (untouched) row stays neutral', () => {
		expect(deriveRowStatus({ name: '', isDuplicate: false, pristine: true })).toBe(
			ROW_STATUS.neutral,
		);
	});

	it('a named duplicate row is duplicate', () => {
		expect(deriveRowStatus({ name: 'Hrnek', isDuplicate: true, pristine: false })).toBe(
			ROW_STATUS.duplicate,
		);
	});

	it('a named, non-duplicate row is ready', () => {
		expect(deriveRowStatus({ name: 'Hrnek', isDuplicate: false, pristine: false })).toBe(
			ROW_STATUS.ready,
		);
	});

	it('error takes precedence over duplicate (blank name wins)', () => {
		expect(deriveRowStatus({ name: '', isDuplicate: true, pristine: false })).toBe(
			ROW_STATUS.error,
		);
	});

	it('a named row is never neutral even when pristine', () => {
		expect(deriveRowStatus({ name: 'Kniha', isDuplicate: false, pristine: true })).toBe(
			ROW_STATUS.ready,
		);
	});

	it('a pristine blank row stays neutral even if flagged duplicate', () => {
		// The pristine (untouched) check runs before duplicate, so an untouched
		// starter row never shows an orange tint.
		expect(deriveRowStatus({ name: '', isDuplicate: true, pristine: true })).toBe(
			ROW_STATUS.neutral,
		);
	});
});

describe('headerSelectionState', () => {
	it('is none when no rows are selected', () => {
		expect(headerSelectionState([{ selected: false }, { selected: false }])).toBe('none');
	});

	it('is all when every row is selected', () => {
		expect(headerSelectionState([{ selected: true }, { selected: true }])).toBe('all');
	});

	it('is some when selection is partial', () => {
		expect(headerSelectionState([{ selected: true }, { selected: false }])).toBe('some');
	});

	it('is none for an empty grid', () => {
		expect(headerSelectionState([])).toBe('none');
	});
});
