import { describe, it, expect, beforeAll } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	czechPluralCategory,
	formatPieceCount,
	finalizeGiftPrice,
	finalizeGiftQuantity,
} from './gift_display.js';

beforeAll(() => {
	overwriteGetLocale(() => 'cs');
});

describe('finalizeGiftPrice', () => {
	it('passes through a finite positive price', () => {
		expect(finalizeGiftPrice(500)).toBe(500);
	});

	it('passes through 0', () => {
		expect(finalizeGiftPrice(0)).toBe(0);
	});

	it('returns null for null (cleared input)', () => {
		expect(finalizeGiftPrice(null)).toBeNull();
	});

	// Regression: clearing a bound <input type="number"> sets Svelte's numeric
	// $state to NaN, not ''. The old String(price).trim() !== '' check treated
	// "NaN" as a non-empty value and sent Number("NaN") to the server, which
	// rejected it (v.number() has no NaN case) with a generic error toast.
	it('returns null for NaN (cleared numeric input)', () => {
		expect(finalizeGiftPrice(NaN)).toBeNull();
	});
});

describe('finalizeGiftQuantity', () => {
	it('passes through a finite quantity', () => {
		expect(finalizeGiftQuantity(3)).toBe(3);
	});

	it('defaults to 1 for NaN (cleared input)', () => {
		expect(finalizeGiftQuantity(NaN)).toBe(1);
	});

	it('defaults to 1 for 0', () => {
		expect(finalizeGiftQuantity(0)).toBe(1);
	});

	it('defaults to 1 for a negative value', () => {
		expect(finalizeGiftQuantity(-2)).toBe(1);
	});
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
		expect(formatPieceCount(null, 'recipient')).toBeNull();
	});

	it('returns "1 kus" for quantity 1 as recipient', () => {
		const result = formatPieceCount(1, 'recipient');
		expect(result).toEqual({ pieceText: '1 kus', reservedText: null });
	});

	it('returns no reserved info for recipient even with reservedCount', () => {
		const result = formatPieceCount(3, 'recipient', 2);
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

	it('returns null reservedText for recipient even at scale', () => {
		const result = formatPieceCount(10, 'recipient', 8);
		expect(result).toEqual({ pieceText: '10 kusů', reservedText: null });
	});
});
