import { describe, expect, it } from 'vitest';
import { shouldNoindexPath } from './robots.js';

describe('crawler policy', () => {
	it('keeps auth and private app routes noindexed while landing routes stay indexable', () => {
		for (const pathname of ['/login', '/en/login', '/home', '/en/settings']) {
			expect(shouldNoindexPath(pathname)).toBe(true);
		}
		for (const pathname of ['/', '/en', '/en/']) {
			expect(shouldNoindexPath(pathname)).toBe(false);
		}
	});

	it.each([
		'/w/abc123',
		'/w/abc123/',
		'/w/abc123/settings',
		'/en/w/abc123',
		'/en/w/abc123/',
		'/en/w/abc123/settings',
	])('noindexes wishlist URL %s', (pathname) => {
		expect(shouldNoindexPath(pathname)).toBe(true);
	});
});
