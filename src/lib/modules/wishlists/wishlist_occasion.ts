import type { WishlistThemeId } from '$lib/theme/wishlist_themes.js';
import { inferOccasionThemeId } from '$lib/theme/wishlist_theme_occasion.js';
import {
	WISHLIST_KIND,
	WISHLIST_OCCASION,
	type WishlistKind,
	type WishlistOccasion,
} from './types.js';

/** The Stálý seznam is the permanent kind; every other occasion is the occasion kind. */
export function wishlistKindForOccasion(occasion: WishlistOccasion): WishlistKind {
	return occasion === WISHLIST_OCCASION.permanent
		? WISHLIST_KIND.permanent
		: WISHLIST_KIND.occasion;
}

/**
 * The occasion after a write that names only the kind, as the previous release's writes do (the
 * database trigger in migration 0034 applies the same rule): becoming permanent makes it the
 * Stálý seznam, leaving permanent makes it Jiná, and an unchanged kind keeps the occasion.
 */
export function occasionAfterKindWrite(
	kind: WishlistKind,
	currentOccasion: WishlistOccasion | null,
): WishlistOccasion {
	if (kind === WISHLIST_KIND.permanent) {
		return WISHLIST_OCCASION.permanent;
	}
	return currentOccasion === null || currentOccasion === WISHLIST_OCCASION.permanent
		? WISHLIST_OCCASION.other
		: currentOccasion;
}

/** Occasions with a matching motif suggest it; the user can still choose another one. */
const OCCASION_SUGGESTED_THEME_IDS: Partial<Record<WishlistOccasion, WishlistThemeId>> = {
	[WISHLIST_OCCASION.christmas]: 'christmas',
	[WISHLIST_OCCASION.wedding]: 'wedding',
	[WISHLIST_OCCASION.baby]: 'baby',
};

/** The motif a new wishlist's occasion, title or event date suggests, or null when none does. */
export function suggestWishlistThemeId(newWishlist: {
	occasion: WishlistOccasion;
	title: string;
	eventDate: Date | null;
}): WishlistThemeId | null {
	return (
		OCCASION_SUGGESTED_THEME_IDS[newWishlist.occasion] ??
		inferOccasionThemeId({ title: newWishlist.title, eventDate: newWishlist.eventDate })
	);
}

/** Event dates are calendar days picked by Czech users; read today on the Prague calendar. */
const OCCASION_TIME_ZONE = 'Europe/Prague';
const CHRISTMAS_EVE_MONTH_INDEX = 11;
const CHRISTMAS_EVE_DAY = 24;

const pragueCalendarFormat = new Intl.DateTimeFormat('en-US', {
	timeZone: OCCASION_TIME_ZONE,
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
});

function pragueCalendarDay(instant: Date): { year: number; monthIndex: number; day: number } {
	const parts = pragueCalendarFormat.formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((candidate) => candidate.type === type)?.value);
	return { year: part('year'), monthIndex: part('month') - 1, day: part('day') };
}

/**
 * The next 24. 12. on the Prague calendar, today included, as a date-picker value (local
 * midnight of that calendar day).
 */
export function nextChristmasEventDate(now: Date): Date {
	const today = pragueCalendarDay(now);
	const christmasHasPassed =
		today.monthIndex === CHRISTMAS_EVE_MONTH_INDEX && today.day > CHRISTMAS_EVE_DAY;
	const year = christmasHasPassed ? today.year + 1 : today.year;
	return new Date(year, CHRISTMAS_EVE_MONTH_INDEX, CHRISTMAS_EVE_DAY);
}

export interface OccasionEventDate {
	eventDate: Date | null;
	/** True while the date is the occasion's pre-fill rather than one the user picked. */
	eventDatePrefilled: boolean;
}

/**
 * Choosing Vánoce pre-fills the next 24. 12. unless the user already picked a date; leaving it
 * drops only that pre-fill, never a date the user picked.
 */
export function eventDateAfterOccasionChange(
	occasion: WishlistOccasion,
	current: OccasionEventDate,
	now: Date,
): OccasionEventDate {
	const userPickedDate = current.eventDate !== null && !current.eventDatePrefilled;
	if (userPickedDate) {
		return current;
	}
	if (occasion === WISHLIST_OCCASION.christmas) {
		return { eventDate: nextChristmasEventDate(now), eventDatePrefilled: true };
	}
	return { eventDate: null, eventDatePrefilled: false };
}

/** The occasion a wishlist shows: a permanent list is always the Stálý seznam. */
export function displayedWishlistOccasion(
	kind: WishlistKind,
	occasion: WishlistOccasion,
): WishlistOccasion {
	return kind === WISHLIST_KIND.permanent ? WISHLIST_OCCASION.permanent : occasion;
}

/** Jiná names nothing, so the wishlist hero shows no label for it; the Stálý seznam is named. */
export function occasionHasDisplayLabel(occasion: WishlistOccasion): boolean {
	return occasion !== WISHLIST_OCCASION.other;
}

/** Jiná and the Stálý seznam say nothing worth a badge on a wishlist card. */
export function occasionHasCardBadge(occasion: WishlistOccasion): boolean {
	return occasion !== WISHLIST_OCCASION.other && occasion !== WISHLIST_OCCASION.permanent;
}
