import { describe, expect, it } from 'vitest';
import {
	getActiveLocaleForUrl,
	getLocalizedAuthCallback,
	getLocalizedAuthHref,
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

	it.each(['https://attacker.example', '//attacker.example', '/\\attacker.example', 'my-lists'])(
		'rejects unsafe auth redirect %s',
		(unsafeRedirectHref) => {
			expect(getLocalizedAuthCallback(unsafeRedirectHref, '/my-lists', 'en')).toBe(
				'/en/my-lists',
			);
		},
	);

	it('localizes default auth callbacks for the requested locale', () => {
		expect(getLocalizedAuthCallback(null, '/my-lists', 'cs')).toBe('/my-lists');
		expect(getLocalizedAuthCallback(null, '/my-lists', 'en')).toBe('/en/my-lists');
	});

	it.each([
		{
			locale: 'cs' as const,
			authenticationHref: '/login',
			redirectHref: '/w/example',
			expectedHref: '/login?redirect=%2Fw%2Fexample',
		},
		{
			locale: 'cs' as const,
			authenticationHref: '/register',
			redirectHref: '/w/example',
			expectedHref: '/register?redirect=%2Fw%2Fexample',
		},
		{
			locale: 'en' as const,
			authenticationHref: '/login',
			redirectHref: '/en/w/example',
			expectedHref: '/en/login?redirect=%2Fen%2Fw%2Fexample',
		},
		{
			locale: 'en' as const,
			authenticationHref: '/register',
			redirectHref: '/en/w/example',
			expectedHref: '/en/register?redirect=%2Fen%2Fw%2Fexample',
		},
	])(
		'builds a localized $authenticationHref link with its wishlist redirect for $locale',
		({ locale, authenticationHref, redirectHref, expectedHref }) => {
			expect(getLocalizedAuthHref(authenticationHref, redirectHref, locale)).toBe(
				expectedHref,
			);
		},
	);

	it('switches the current URL while preserving search and hash', () => {
		const currentUrl = new URL('https://prejemesi.cz/en/login?redirect=/en/my-lists#form');

		expect(localizeCurrentHref(currentUrl, 'cs')).toBe('/login?redirect=/en/my-lists#form');
	});
});
