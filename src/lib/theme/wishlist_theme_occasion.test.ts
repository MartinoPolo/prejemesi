import { describe, expect, it } from 'vitest';
import { inferOccasionThemeId } from './wishlist_theme_occasion.js';

/** Midnight on a Prague calendar day, as the Czech date picker produces it. */
function pragueDay(year: number, month: number, day: number): Date {
	const winterOffsetHours = 1;
	return new Date(Date.UTC(year, month - 1, day, -winterOffsetHours));
}

describe('inferOccasionThemeId', () => {
	it.each([
		['Vánoce 2026', 'christmas'],
		['vanoce u babicky', 'christmas'],
		['Dárky k Vánocům', 'christmas'],
		['Vánoční přání', 'christmas'],
		['Ježíšek pro Aničku', 'christmas'],
		['Christmas list', 'christmas'],
		['XMAS', 'christmas'],
		['Svatba Jany a Petra', 'wedding'],
		['Svatební dary', 'wedding'],
		['Our wedding', 'wedding'],
		['Miminko', 'baby'],
		['Výbavička pro prcka', 'baby'],
		['Baby shower', 'baby'],
		['Baby registry', 'baby'],
	] as const)('infers the theme from the title %s', (title, themeId) => {
		expect(inferOccasionThemeId({ title, eventDate: null })).toBe(themeId);
	});

	it('returns null for a title and date that imply no occasion', () => {
		expect(
			inferOccasionThemeId({ title: 'Narozeniny', eventDate: pragueDay(2026, 6, 12) }),
		).toBeNull();
		expect(inferOccasionThemeId({ title: 'Přání', eventDate: null })).toBeNull();
	});

	it('infers Christmas from an event date between 1 and 26 December', () => {
		expect(inferOccasionThemeId({ title: 'Přání', eventDate: pragueDay(2026, 12, 1) })).toBe(
			'christmas',
		);
		expect(inferOccasionThemeId({ title: 'Přání', eventDate: pragueDay(2026, 12, 24) })).toBe(
			'christmas',
		);
		expect(inferOccasionThemeId({ title: 'Přání', eventDate: pragueDay(2026, 12, 26) })).toBe(
			'christmas',
		);
	});

	it('ignores dates just outside the Christmas season on the Prague calendar', () => {
		expect(
			inferOccasionThemeId({ title: 'Přání', eventDate: pragueDay(2026, 11, 30) }),
		).toBeNull();
		expect(
			inferOccasionThemeId({ title: 'Přání', eventDate: pragueDay(2026, 12, 27) }),
		).toBeNull();
	});

	it('prefers the occasion named in the title over a December date', () => {
		expect(inferOccasionThemeId({ title: 'Svatba', eventDate: pragueDay(2026, 12, 12) })).toBe(
			'wedding',
		);
	});
});
