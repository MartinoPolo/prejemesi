import { getDomain } from 'tldts';
import { describe, expect, it } from 'vitest';
import { extractGiftStoreDomain } from './gift_store.js';

const storeDomain = (url: string | null) => extractGiftStoreDomain(url, getDomain);

describe('extractGiftStoreDomain (issue #650)', () => {
	it('merges subdomains into the registrable domain', () => {
		expect(storeDomain('https://eshop.decathlon.cz/boty')).toBe('decathlon.cz');
		expect(storeDomain('https://www.decathlon.cz/')).toBe('decathlon.cz');
		expect(storeDomain('decathlon.cz/stany')).toBe('decathlon.cz');
	});

	it('keeps multi-part public suffixes whole', () => {
		expect(storeDomain('https://www.amazon.co.uk/dp/123')).toBe('amazon.co.uk');
		expect(storeDomain('https://shop.example.co.uk/item')).toBe('example.co.uk');
	});

	it('keeps country variants as separate stores', () => {
		expect(storeDomain('https://www.decathlon.sk/')).toBe('decathlon.sk');
		expect(storeDomain('https://www.decathlon.cz/')).toBe('decathlon.cz');
	});

	it('keeps sites on a private public suffix as separate stores', () => {
		expect(storeDomain('https://alice.github.io/shop')).toBe('alice.github.io');
		expect(storeDomain('https://bob.github.io')).toBe('bob.github.io');
	});

	it('uses the host itself for an IP address', () => {
		expect(storeDomain('http://192.168.1.10/gift')).toBe('192.168.1.10');
	});

	it('returns null for missing or invalid URLs without throwing', () => {
		expect(storeDomain(null)).toBeNull();
		expect(storeDomain('')).toBeNull();
		expect(storeDomain('not a url')).toBeNull();
		expect(storeDomain('https://[::1]/')).toBeNull();
		expect(storeDomain('ftp://decathlon.cz/')).toBeNull();
	});
});
