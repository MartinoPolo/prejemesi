import { describe, it, expect } from 'vitest';
import {
	normalizeGiftUrl,
	extractGiftUrlDomain,
	normalizeGiftLinks,
	getPrimaryGiftLink,
	createGiftLinkId,
	ensureGiftLinkIds,
} from './gift_url.js';
import { extractGiftDomain } from './gift_display.js';
import { MAX_GIFT_LINKS } from './types.js';

describe('normalizeGiftUrl', () => {
	it('returns null for null, undefined, and blank input', () => {
		expect(normalizeGiftUrl(null)).toBeNull();
		expect(normalizeGiftUrl(undefined)).toBeNull();
		expect(normalizeGiftUrl('   ')).toBeNull();
	});

	it('rejects non-http(s) protocols', () => {
		expect(normalizeGiftUrl(' javascript://example.com/%0Aalert(1)')).toBeNull();
		expect(normalizeGiftUrl('ftp://example.com/file')).toBeNull();
	});

	it('trims and normalizes valid http(s) URLs', () => {
		expect(normalizeGiftUrl(' https://example.com/path ')).toBe('https://example.com/path');
	});

	it('prepends https:// for bare domain with TLD', () => {
		expect(normalizeGiftUrl('alza.cz')).toBe('https://alza.cz/');
	});

	it('prepends https:// for bare domain with path', () => {
		expect(normalizeGiftUrl('www.example.com/path')).toBe('https://www.example.com/path');
	});

	it('rejects single word without a dot (not a valid hostname)', () => {
		expect(normalizeGiftUrl('example')).toBeNull();
	});

	it('rejects localhost (no dot in hostname)', () => {
		expect(normalizeGiftUrl('localhost')).toBeNull();
	});

	it('rejects ftp scheme (non-http not blindly prepended)', () => {
		expect(normalizeGiftUrl('ftp://evil.com')).toBeNull();
	});

	it('normalizes bare domain with path (alza.cz/product)', () => {
		expect(normalizeGiftUrl('alza.cz/product')).toBe('https://alza.cz/product');
	});
});

describe('extractGiftUrlDomain', () => {
	it('strips the www prefix and returns the hostname', () => {
		expect(extractGiftUrlDomain('https://www.alza.cz/playstation-5')).toBe('alza.cz');
	});

	it('returns null for invalid URLs', () => {
		expect(extractGiftUrlDomain('not a url')).toBeNull();
	});
});

describe('normalizeGiftLinks', () => {
	it('returns an empty array for null or undefined', () => {
		expect(normalizeGiftLinks(null)).toEqual([]);
		expect(normalizeGiftLinks(undefined)).toEqual([]);
	});

	it('drops links whose URL is not valid http(s)', () => {
		const result = normalizeGiftLinks([
			{ url: 'javascript://evil' },
			{ url: 'https://example.com/ok' },
			{ url: '   ' },
		]);
		expect(result).toEqual([{ url: 'https://example.com/ok' }]);
	});

	it('preserves order so links[0] stays primary', () => {
		const result = normalizeGiftLinks([
			{ url: 'https://a.example.com' },
			{ url: 'https://b.example.com' },
		]);
		expect(result.map((l) => l.url)).toEqual([
			'https://a.example.com/',
			'https://b.example.com/',
		]);
	});

	it('trims labels and drops empty ones', () => {
		const result = normalizeGiftLinks([
			{ url: 'https://example.com/1', label: '  Alza  ' },
			{ url: 'https://example.com/2', label: '   ' },
		]);
		expect(result).toEqual([
			{ url: 'https://example.com/1', label: 'Alza' },
			{ url: 'https://example.com/2' },
		]);
	});

	it('caps the list at MAX_GIFT_LINKS', () => {
		const input = Array.from({ length: MAX_GIFT_LINKS + 5 }, (_, i) => ({
			url: `https://example.com/${i}`,
		}));
		expect(normalizeGiftLinks(input)).toHaveLength(MAX_GIFT_LINKS);
	});

	it('strips the client-only id so it never persists', () => {
		const result = normalizeGiftLinks([{ url: 'https://example.com/1', id: 'gift-link-7' }]);
		expect(result).toEqual([{ url: 'https://example.com/1' }]);
	});
});

describe('createGiftLinkId', () => {
	it('returns a unique id on each call', () => {
		const a = createGiftLinkId();
		const b = createGiftLinkId();
		expect(a).not.toBe(b);
	});
});

describe('ensureGiftLinkIds', () => {
	it('returns an empty array for null or undefined', () => {
		expect(ensureGiftLinkIds(null)).toEqual([]);
		expect(ensureGiftLinkIds(undefined)).toEqual([]);
	});

	it('assigns an id to links that lack one', () => {
		const result = ensureGiftLinkIds([{ url: 'https://example.com' }]);
		expect(result[0]?.id).toBeDefined();
		expect(result[0]?.url).toBe('https://example.com');
	});

	it('keeps an existing id untouched', () => {
		const result = ensureGiftLinkIds([{ url: 'https://example.com', id: 'keep-me' }]);
		expect(result[0]?.id).toBe('keep-me');
	});

	it('assigns distinct ids across links', () => {
		const result = ensureGiftLinkIds([{ url: 'https://a.com' }, { url: 'https://b.com' }]);
		expect(result[0]?.id).not.toBe(result[1]?.id);
	});

	it('does not mutate the input objects', () => {
		const input = [{ url: 'https://example.com' }];
		ensureGiftLinkIds(input);
		expect('id' in input[0]!).toBe(false);
	});
});

describe('getPrimaryGiftLink', () => {
	it('returns links[0] when present', () => {
		const link = { url: 'https://example.com' };
		expect(getPrimaryGiftLink([link, { url: 'https://other.com' }])).toBe(link);
	});

	it('returns null for empty, null, or undefined', () => {
		expect(getPrimaryGiftLink([])).toBeNull();
		expect(getPrimaryGiftLink(null)).toBeNull();
		expect(getPrimaryGiftLink(undefined)).toBeNull();
	});
});

describe('extractGiftDomain', () => {
	it('returns the primary link domain', () => {
		expect(
			extractGiftDomain([
				{ url: 'https://www.alza.cz/x' },
				{ url: 'https://www.datart.cz/x' },
			]),
		).toBe('alza.cz');
	});

	it('returns null when there are no links', () => {
		expect(extractGiftDomain([])).toBeNull();
		expect(extractGiftDomain(null)).toBeNull();
	});
});
