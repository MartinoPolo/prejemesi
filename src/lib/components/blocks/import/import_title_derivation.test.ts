import { describe, it, expect } from 'vitest';
import { deriveWishlistTitle } from './import_title_derivation.js';

describe('deriveWishlistTitle', () => {
	it('strips .csv and takes the segment after the last " - "', () => {
		expect(deriveWishlistTitle('Dárky Rosie sdílená tabulka - Dárky Rosie.csv')).toBe(
			'Dárky Rosie',
		);
	});

	it('strips .csv from a simple filename', () => {
		expect(deriveWishlistTitle('simple.csv')).toBe('simple');
	});

	it('takes the segment after the last " - " in a multi-dash name', () => {
		expect(deriveWishlistTitle('A - B - C.tsv')).toBe('C');
	});

	it('returns the name as-is when there is no extension', () => {
		expect(deriveWishlistTitle('no_extension')).toBe('no_extension');
	});

	it('returns empty string for empty input', () => {
		expect(deriveWishlistTitle('')).toBe('');
	});

	it('trims surrounding whitespace', () => {
		expect(deriveWishlistTitle('  spaces.csv  ')).toBe('spaces');
	});

	it('returns empty string when filename is just .csv', () => {
		expect(deriveWishlistTitle('.csv')).toBe('');
	});
});
