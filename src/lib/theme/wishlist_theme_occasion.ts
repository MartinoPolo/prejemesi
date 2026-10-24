import type { WishlistThemeId } from './wishlist_themes.js';

/**
 * Word stems matched at the start of a title word after folding case and diacritics, so Czech
 * inflections (Vánoce, vánoční, k Vánocům) share one stem. Listed in precedence order.
 */
const OCCASION_TITLE_STEMS: ReadonlyArray<{ themeId: WishlistThemeId; stems: readonly string[] }> =
	[
		{ themeId: 'christmas', stems: ['vanoc', 'jezis', 'christmas', 'xmas'] },
		{ themeId: 'wedding', stems: ['svatb', 'svateb', 'wedding'] },
		{ themeId: 'baby', stems: ['mimin', 'vybavick', 'baby'] },
	];

/** Event dates are calendar days picked by Czech users; read them on the Prague calendar. */
const OCCASION_TIME_ZONE = 'Europe/Prague';
const LAST_CHRISTMAS_SEASON_DAY = 26;

const occasionDateFormat = new Intl.DateTimeFormat('en-US', {
	timeZone: OCCASION_TIME_ZONE,
	month: 'numeric',
	day: 'numeric',
});

function titleWords(title: string): string[] {
	return title
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word !== '');
}

function isChristmasSeason(eventDate: Date): boolean {
	const parts = occasionDateFormat.formatToParts(eventDate);
	const month = Number(parts.find((part) => part.type === 'month')?.value);
	const day = Number(parts.find((part) => part.type === 'day')?.value);
	return month === 12 && day >= 1 && day <= LAST_CHRISTMAS_SEASON_DAY;
}

/** The theme a new wishlist's title or event date implies, or null when nothing does. */
export function inferOccasionThemeId(occasion: {
	title: string;
	eventDate: Date | null;
}): WishlistThemeId | null {
	const words = titleWords(occasion.title);
	const titleMatch = OCCASION_TITLE_STEMS.find(({ stems }) =>
		words.some((word) => stems.some((stem) => word.startsWith(stem))),
	);
	if (titleMatch !== undefined) {
		return titleMatch.themeId;
	}
	if (occasion.eventDate !== null && isChristmasSeason(occasion.eventDate)) {
		return 'christmas';
	}
	return null;
}
