import { describe, it, expect, beforeAll } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import { czechPluralCategory, formatPieceCount } from './gift_display.js';

beforeAll(() => {
	overwriteGetLocale(() => 'cs');
});

describe('czechPluralCategory', () => {
	it('returns "one" for 1', () => {
		expect(czechPluralCategory(1)).toBe('one');
	});

	it('returns "few" for 2', () => {
		expect(czechPluralCategory(2)).toBe('few');
	});

	it('returns "few" for 3', () => {
		expect(czechPluralCategory(3)).toBe('few');
	});

	it('returns "few" for 4', () => {
		expect(czechPluralCategory(4)).toBe('few');
	});

	it('returns "other" for 5', () => {
		expect(czechPluralCategory(5)).toBe('other');
	});

	it('returns "other" for 0', () => {
		expect(czechPluralCategory(0)).toBe('other');
	});

	it('returns "other" for 100', () => {
		expect(czechPluralCategory(100)).toBe('other');
	});
});

describe('formatPieceCount', () => {
	it('returns null for null quantity', () => {
		expect(formatPieceCount(null, 'owner')).toBeNull();
	});

	it('returns "1 kus" for quantity 1 as owner', () => {
		const result = formatPieceCount(1, 'owner');
		expect(result).toEqual({ pieceText: '1 kus', reservedText: null });
	});

	it('returns no reserved info for owner even with reservedCount', () => {
		const result = formatPieceCount(3, 'owner', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: null });
	});

	it('returns reserved count for visitor', () => {
		const result = formatPieceCount(3, 'visitor', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: '2 rezervováno' });
	});

	it('returns reserved count for moderator (same as visitor)', () => {
		const result = formatPieceCount(3, 'moderator', 2);
		expect(result).toEqual({ pieceText: '3 kusy', reservedText: '2 rezervováno' });
	});

	it('returns fully reserved for visitor when all reserved', () => {
		const result = formatPieceCount(5, 'visitor', 5);
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: 'plně rezervováno' });
	});

	it('returns null reservedText for visitor when reservedCount is 0', () => {
		const result = formatPieceCount(5, 'visitor', 0);
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: null });
	});

	it('returns null reservedText for visitor when reservedCount is omitted', () => {
		const result = formatPieceCount(5, 'visitor');
		expect(result).toEqual({ pieceText: '5 kusů', reservedText: null });
	});

	it('returns fully reserved for visitor when quantity is 1 and reserved is 1', () => {
		const result = formatPieceCount(1, 'visitor', 1);
		expect(result).toEqual({ pieceText: '1 kus', reservedText: 'plně rezervováno' });
	});

	it('returns null reservedText for owner even at scale', () => {
		const result = formatPieceCount(10, 'owner', 8);
		expect(result).toEqual({ pieceText: '10 kusů', reservedText: null });
	});
});
