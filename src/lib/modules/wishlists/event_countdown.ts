import * as m from '$lib/paraglide/messages.js';

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized.getTime();
}

/**
 * Day-granular localized countdown to a wishlist event (e.g. "za 5 dní" / "in 5 days"), or
 * `null` when there is no date or the event has already passed (a past event is not actionable,
 * so surfaces nothing). Drives the passive "don't forget" reminder in the nav dropdowns – no
 * scheduled job required, the date already lives on the wishlist row.
 */
export function eventCountdown(eventDate: Date | null, now: Date = new Date()): string | null {
	if (eventDate === null) {
		return null;
	}
	const days = Math.round((startOfDay(eventDate) - startOfDay(now)) / DAY_MS);
	if (days < 0) {
		return null;
	}
	if (days === 0) {
		return m.countdown_today();
	}
	if (days === 1) {
		return m.countdown_tomorrow();
	}
	// Czech needs two plural forms: 2–4 → "dny", 5+ → "dní". English collapses both to "days".
	if (days < 5) {
		return m.countdown_days_few({ days });
	}
	return m.countdown_days_many({ days });
}
