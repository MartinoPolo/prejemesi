import { describe, it, expect } from 'vitest';
import { parsePrice, validateDraft, findDuplicates, type GiftDraft } from './gift_draft.js';
import { DEFAULT_DRAFT_PRIORITY, GIFT_CURRENCIES, MAX_GIFT_LINKS, type GiftLink } from './types.js';

function makeDraft(overrides: Partial<GiftDraft> = {}): GiftDraft {
	return {
		name: 'Gift',
		description: null,
		links: [],
		price: null,
		currency: GIFT_CURRENCIES.CZK,
		priority: DEFAULT_DRAFT_PRIORITY,
		...overrides,
	};
}

describe('parsePrice', () => {
	it('parses a space-separated CZK amount', () => {
		expect(parsePrice('1 299 Kč')).toEqual({ price: 1299, currency: GIFT_CURRENCIES.CZK });
	});

	it('parses the ASCII "Kc" currency token (no háček)', () => {
		expect(parsePrice('1 299 Kc')).toEqual({ price: 1299, currency: GIFT_CURRENCIES.CZK });
	});

	it('treats a dot as a thousands separator when 3 trailing digits', () => {
		expect(parsePrice('1.299')).toEqual({ price: 1299, currency: GIFT_CURRENCIES.CZK });
	});

	it('treats a dot followed by 1–2 digits as a decimal portion', () => {
		// Boundary opposite of the 3-digit thousands case above: 1–2 trailing
		// digits after a separator are a decimal fraction, rounded to an integer.
		expect(parsePrice('49.90')).toEqual({ price: 50, currency: GIFT_CURRENCIES.CZK });
		expect(parsePrice('1.29')).toEqual({ price: 1, currency: GIFT_CURRENCIES.CZK });
	});

	it('strips a trailing Czech ,- suffix', () => {
		expect(parsePrice('1299,-')).toEqual({ price: 1299, currency: GIFT_CURRENCIES.CZK });
	});

	it('handles multiple thousands separators', () => {
		expect(parsePrice('1 234 567')).toEqual({
			price: 1234567,
			currency: GIFT_CURRENCIES.CZK,
		});
	});

	it('detects EUR from symbol and word', () => {
		expect(parsePrice('€49')).toEqual({ price: 49, currency: GIFT_CURRENCIES.EUR });
		expect(parsePrice('49 EUR')).toEqual({ price: 49, currency: GIFT_CURRENCIES.EUR });
	});

	it('detects USD from symbol and word', () => {
		expect(parsePrice('$50')).toEqual({ price: 50, currency: GIFT_CURRENCIES.USD });
		expect(parsePrice('50 USD')).toEqual({ price: 50, currency: GIFT_CURRENCIES.USD });
	});

	it('rounds a decimal portion to the nearest integer', () => {
		expect(parsePrice('49,90 €')).toEqual({ price: 50, currency: GIFT_CURRENCIES.EUR });
	});

	it('returns null price with default currency for non-numeric input', () => {
		expect(parsePrice('')).toEqual({ price: null, currency: GIFT_CURRENCIES.CZK });
		expect(parsePrice(null)).toEqual({ price: null, currency: GIFT_CURRENCIES.CZK });
		expect(parsePrice(undefined)).toEqual({ price: null, currency: GIFT_CURRENCIES.CZK });
		expect(parsePrice('abc')).toEqual({ price: null, currency: GIFT_CURRENCIES.CZK });
	});
});

describe('validateDraft', () => {
	it('marks blank and whitespace-only names as invalid', () => {
		expect(validateDraft(makeDraft({ name: '' })).valid).toBe(false);
		expect(validateDraft(makeDraft({ name: '   ' })).valid).toBe(false);
	});

	it('marks a non-blank name as valid and trims it', () => {
		const result = validateDraft(makeDraft({ name: '  Lego  ' }));
		expect(result.valid).toBe(true);
		expect(result.normalized.name).toBe('Lego');
	});

	it('normalizes empty description to null and trims content', () => {
		expect(validateDraft(makeDraft({ description: '  ' })).normalized.description).toBeNull();
		expect(validateDraft(makeDraft({ description: '  hi  ' })).normalized.description).toBe(
			'hi',
		);
	});

	it('drops links whose URL is not valid http(s)', () => {
		const result = validateDraft(
			makeDraft({ links: [{ url: 'javascript://evil' }, { url: 'https://example.com/ok' }] }),
		);
		expect(result.normalized.links).toEqual([{ url: 'https://example.com/ok' }]);
	});

	it('caps links at MAX_GIFT_LINKS', () => {
		const links: GiftLink[] = Array.from({ length: MAX_GIFT_LINKS + 5 }, (_, i) => ({
			url: `https://example.com/${i}`,
		}));
		const result = validateDraft(makeDraft({ links }));
		expect(result.normalized.links).toHaveLength(MAX_GIFT_LINKS);
	});
});

describe('findDuplicates', () => {
	it('matches names ignoring case and whitespace', () => {
		const existing = [{ id: 'a', name: 'lego set' }];
		const result = findDuplicates(makeDraft({ name: 'Lego  Set' }), existing);
		expect(result).toEqual([{ id: 'a', name: 'lego set' }]);
	});

	it('matches names ignoring diacritics', () => {
		const existing = [{ id: 'b', name: 'ruzova kniha' }];
		const result = findDuplicates(makeDraft({ name: 'Růžová Kniha' }), existing);
		expect(result).toEqual([{ id: 'b', name: 'ruzova kniha' }]);
	});

	it('matches by link host+path ignoring www, query, hash, trailing slash', () => {
		const existing = [
			{ id: 'c', name: 'Other', links: [{ url: 'https://alza.cz/lego-123?ref=x#top' }] },
		];
		const result = findDuplicates(
			makeDraft({ name: 'Mismatch', links: [{ url: 'https://www.alza.cz/lego-123/' }] }),
			existing,
		);
		expect(result).toEqual(existing);
	});

	it('returns empty when neither name nor links match', () => {
		const existing = [
			{ id: 'd', name: 'Something Else', links: [{ url: 'https://other.com/x' }] },
		];
		const result = findDuplicates(
			makeDraft({ name: 'Unique', links: [{ url: 'https://example.com/y' }] }),
			existing,
		);
		expect(result).toEqual([]);
	});

	it('does not match two blank names', () => {
		const existing = [{ id: 'e', name: '' }];
		const result = findDuplicates(makeDraft({ name: '   ' }), existing);
		expect(result).toEqual([]);
	});

	it('returns the matched existing objects preserving id', () => {
		const existing = [
			{ id: '1', name: 'No Match', links: [] as GiftLink[] },
			{ id: '2', name: 'Target', links: [] as GiftLink[] },
		];
		const result = findDuplicates(makeDraft({ name: 'target' }), existing);
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('2');
	});
});
