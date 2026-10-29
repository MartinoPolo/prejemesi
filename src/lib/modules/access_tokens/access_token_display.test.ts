import { describe, it, expect, beforeAll } from 'vitest';
import { overwriteGetLocale } from '$lib/paraglide/runtime.js';
import {
	accessTokenAbilitySentence,
	accessTokenCountLabel,
	accessTokenRegenerateKeptLine,
	accessTokenWishlistLine,
	isAccessTokenExpiringSoon,
} from './access_token_display.js';
import { AGENT_SCOPE } from './scopes.js';

beforeAll(() => {
	overwriteGetLocale(() => 'cs');
});

/** Czech ICU list formatting keeps the conjunction "a" with the next word by a no-break space. */
function normalizeSpaces(value: string): string {
	return value.replace(/ /g, ' ');
}

describe('accessTokenAbilitySentence', () => {
	it('says a read-only token only reads', () => {
		expect(accessTokenAbilitySentence([AGENT_SCOPE.read], null)).toBe(
			'Jen čte na všech seznamech',
		);
	});

	it('lists the granted abilities after reading, joined in Czech', () => {
		expect(
			normalizeSpaces(
				accessTokenAbilitySentence([AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite], 1),
			),
		).toBe('Čte a upravuje dárky na 1 seznamu');
		expect(
			normalizeSpaces(
				accessTokenAbilitySentence(
					[
						AGENT_SCOPE.read,
						AGENT_SCOPE.reservationsWrite,
						AGENT_SCOPE.reservationsIdentities,
					],
					3,
				),
			),
		).toBe('Čte, rezervuje a vidí jména dárců na 3 seznamech');
	});
});

describe('accessTokenRegenerateKeptLine', () => {
	it('restates the kept abilities in lower case and notes a skipped review', () => {
		expect(
			normalizeSpaces(
				accessTokenRegenerateKeptLine({
					scopes: [AGENT_SCOPE.read, AGENT_SCOPE.giftsWrite],
					wishlists: [{ id: 'a', title: 'Vánoce pro babičku' }],
					fastForward: true,
				}),
			),
		).toBe(
			'Název, oprávnění i seznamy zůstanou stejné: čte a upravuje dárky na 1 seznamu, bez kontroly.',
		);
		expect(
			accessTokenRegenerateKeptLine({
				scopes: [AGENT_SCOPE.read],
				wishlists: null,
				fastForward: false,
			}),
		).toBe('Název, oprávnění i seznamy zůstanou stejné: jen čte na všech seznamech.');
	});
});

describe('accessTokenWishlistLine', () => {
	it('names all wishlists, or at most two titles and how many more', () => {
		expect(accessTokenWishlistLine(null)).toBe('Všechny seznamy');
		expect(accessTokenWishlistLine([{ id: 'a', title: 'Vánoce pro babičku' }])).toBe(
			'Jen: Vánoce pro babičku',
		);
		expect(
			accessTokenWishlistLine([
				{ id: 'a', title: 'Martinovy narozeniny' },
				{ id: 'b', title: 'Vánoce pro babičku' },
				{ id: 'c', title: 'Petrovy Vánoce' },
			]),
		).toBe('Jen: Martinovy narozeniny, Vánoce pro babičku +1');
	});
});

describe('accessTokenCountLabel', () => {
	it('counts active tokens and adds expired ones with Czech plurals', () => {
		expect(accessTokenCountLabel([{ expired: false }, { expired: false }])).toBe('2 aktivní');
		expect(accessTokenCountLabel([{ expired: false }, { expired: true }])).toBe(
			'1 aktivní, 1 vypršel',
		);
		expect(accessTokenCountLabel([{ expired: true }, { expired: true }])).toBe(
			'0 aktivní, 2 vypršely',
		);
	});
});

describe('isAccessTokenExpiringSoon', () => {
	const now = new Date('2026-10-13T12:00:00Z');

	it('warns within a week of expiry, but not for expired or distant tokens', () => {
		expect(
			isAccessTokenExpiringSoon(
				{ expired: false, expiresAt: new Date('2026-10-16T12:00:00Z') },
				now,
			),
		).toBe(true);
		expect(
			isAccessTokenExpiringSoon(
				{ expired: false, expiresAt: new Date('2027-10-13T12:00:00Z') },
				now,
			),
		).toBe(false);
		expect(
			isAccessTokenExpiringSoon(
				{ expired: true, expiresAt: new Date('2026-09-01T12:00:00Z') },
				now,
			),
		).toBe(false);
	});
});
