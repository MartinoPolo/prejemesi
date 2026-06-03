import { describe, it, expect } from 'vitest';
import { validateImportLimits, MAX_IMPORT_ROWS, MAX_IMPORT_BYTES } from './import_limits.js';

describe('validateImportLimits', () => {
	it('accepts 200 rows and 500KB', () => {
		expect(validateImportLimits(200, 500_000)).toEqual({ valid: true, error: null });
	});

	it('rejects 201 rows with error "rows"', () => {
		expect(validateImportLimits(201, 500_000)).toEqual({ valid: false, error: 'rows' });
	});

	it('rejects 1_048_577 bytes with error "size"', () => {
		expect(validateImportLimits(200, 1_048_577)).toEqual({ valid: false, error: 'size' });
	});

	it('accepts 0 rows (empty-after-parse handled separately)', () => {
		expect(validateImportLimits(0, 0)).toEqual({ valid: true, error: null });
	});

	it('accepts exactly at the limits', () => {
		expect(validateImportLimits(MAX_IMPORT_ROWS, MAX_IMPORT_BYTES)).toEqual({
			valid: true,
			error: null,
		});
	});

	it('prioritizes rows error over size error when both exceed', () => {
		expect(validateImportLimits(201, 1_048_577)).toEqual({ valid: false, error: 'rows' });
	});
});
