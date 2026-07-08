import { describe, expect, it } from 'vitest';
import {
	getActiveLocaleForUrl,
	getLocalizedAuthCallback,
	localizeCurrentHref,
	resolveLocalePreference,
} from './locale.js';

describe('locale helpers', () => {
	it('prefers explicit locale over account preference and cookie', () => {
		expect(resolveLocalePreference('cs', 'en', 'en')).toBe('cs');
		expect(resolveLocalePreference('en', 'cs', 'cs')).toBe('en');
	});

	it('falls back from account preference to cookie to Czech base locale', () => {
		expect(resolveLocalePreference(null, 'en', 'cs')).toBe('en');
		expect(resolveLocalePreference(null, null, 'en')).toBe('en');
		expect(resolveLocalePreference(null, null, null)).toBe('cs');
	});

	it('detects explicit locale prefixes on server-side URL strings', () => {
		expect(getActiveLocaleForUrl('https://prejemesi.cz/en')).toBe('en');
		expect(getActiveLocaleForUrl('/en/my-lists')).toBe('en');
		expect(getActiveLocaleForUrl('/my-lists')).toBe('cs');
	});

	it('keeps explicit auth redirects unchanged', () => {
		expect(getLocalizedAuthCallback('/en/my-lists', '/my-lists', 'cs')).toBe('/en/my-lists');
	});

	it('localizes default auth callbacks for the requested locale', () => {
		expect(getLocalizedAuthCallback(null, '/my-lists', 'cs')).toBe('/my-lists');
		expect(getLocalizedAuthCallback(null, '/my-lists', 'en')).toBe('/en/my-lists');
	});

	it('switches the current URL while preserving search and hash', () => {
		const currentUrl = new URL('https://prejemesi.cz/en/login?redirect=/en/my-lists#form');

		expect(localizeCurrentHref(currentUrl, 'cs')).toBe('/login?redirect=/en/my-lists#form');
	});
});
