import { describe, expect, it } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { WISHLIST_KIND, WISHLIST_OCCASION, WISHLIST_OCCASIONS } from './types.js';
import {
	eventDateAfterOccasionChange,
	nextChristmasEventDate,
	occasionAfterKindWrite,
	occasionHasCardBadge,
	suggestWishlistThemeId,
	wishlistKindForOccasion,
} from './wishlist_occasion.js';
import { WISHLIST_OCCASION_DISPLAY } from './wishlist_occasion_display.js';

describe('wishlist occasions', () => {
	it('offers the eight occasions with Stálý seznam last', () => {
		expect(WISHLIST_OCCASIONS).toEqual([
			WISHLIST_OCCASION.christmas,
			WISHLIST_OCCASION.birthday,
			WISHLIST_OCCASION.nameDay,
			WISHLIST_OCCASION.wedding,
			WISHLIST_OCCASION.baby,
			WISHLIST_OCCASION.graduation,
			WISHLIST_OCCASION.other,
			WISHLIST_OCCASION.permanent,
		]);
	});

	it('gives every occasion its own icon and label', () => {
		const icons = WISHLIST_OCCASIONS.map(
			(occasion) => WISHLIST_OCCASION_DISPLAY[occasion].icon,
		);
		const labels = WISHLIST_OCCASIONS.map((occasion) =>
			WISHLIST_OCCASION_DISPLAY[occasion].label(),
		);

		expect(new Set(icons).size).toBe(WISHLIST_OCCASIONS.length);
		expect(new Set(labels).size).toBe(WISHLIST_OCCASIONS.length);
		expect(WISHLIST_OCCASION_DISPLAY.christmas.label()).toBe(m.wishlist_occasion_christmas());
		expect(WISHLIST_OCCASION_DISPLAY.permanent.label()).toBe(m.wishlist_kind_permanent());
	});
});

describe('wishlistKindForOccasion', () => {
	it('makes only the Stálý seznam permanent', () => {
		for (const occasion of WISHLIST_OCCASIONS) {
			expect(wishlistKindForOccasion(occasion)).toBe(
				occasion === WISHLIST_OCCASION.permanent
					? WISHLIST_KIND.permanent
					: WISHLIST_KIND.occasion,
			);
		}
	});
});

describe('occasionAfterKindWrite', () => {
	it('makes a list becoming permanent the Stálý seznam', () => {
		expect(occasionAfterKindWrite(WISHLIST_KIND.permanent, WISHLIST_OCCASION.birthday)).toBe(
			WISHLIST_OCCASION.permanent,
		);
	});

	it('makes a list leaving permanent Jiná', () => {
		expect(occasionAfterKindWrite(WISHLIST_KIND.occasion, WISHLIST_OCCASION.permanent)).toBe(
			WISHLIST_OCCASION.other,
		);
	});

	it('keeps the occasion when the kind stays an occasion', () => {
		expect(occasionAfterKindWrite(WISHLIST_KIND.occasion, WISHLIST_OCCASION.wedding)).toBe(
			WISHLIST_OCCASION.wedding,
		);
	});

	it('makes a new occasion list Jiná', () => {
		expect(occasionAfterKindWrite(WISHLIST_KIND.occasion, null)).toBe(WISHLIST_OCCASION.other);
	});
});

describe('nextChristmasEventDate', () => {
	it('picks this year before and on 24. 12.', () => {
		expect(nextChristmasEventDate(new Date('2026-11-02T10:00:00Z'))).toEqual(
			new Date(2026, 11, 24),
		);
		expect(nextChristmasEventDate(new Date('2026-12-24T12:00:00Z'))).toEqual(
			new Date(2026, 11, 24),
		);
	});

	it('picks next year after 24. 12.', () => {
		expect(nextChristmasEventDate(new Date('2026-12-25T10:00:00Z'))).toEqual(
			new Date(2027, 11, 24),
		);
	});

	it('reads the day on the Prague calendar', () => {
		// 23:30 UTC on 24. 12. is already 25. 12. in Prague.
		expect(nextChristmasEventDate(new Date('2026-12-24T23:30:00Z'))).toEqual(
			new Date(2027, 11, 24),
		);
		// 23:30 UTC on 31. 12. is already 1. 1. of the next year in Prague.
		expect(nextChristmasEventDate(new Date('2026-12-31T23:30:00Z'))).toEqual(
			new Date(2027, 11, 24),
		);
	});
});

describe('eventDateAfterOccasionChange', () => {
	const now = new Date('2026-11-02T10:00:00Z');
	const pickedDate = new Date(2026, 10, 30);

	it('pre-fills the next 24. 12. for Vánoce when no date is set', () => {
		expect(
			eventDateAfterOccasionChange(
				WISHLIST_OCCASION.christmas,
				{ eventDate: null, eventDatePrefilled: false },
				now,
			),
		).toEqual({ eventDate: new Date(2026, 11, 24), eventDatePrefilled: true });
	});

	it('never replaces a date the user picked', () => {
		const current = { eventDate: pickedDate, eventDatePrefilled: false };

		expect(eventDateAfterOccasionChange(WISHLIST_OCCASION.christmas, current, now)).toEqual(
			current,
		);
		expect(eventDateAfterOccasionChange(WISHLIST_OCCASION.birthday, current, now)).toEqual(
			current,
		);
	});

	it('drops the pre-filled date when leaving Vánoce', () => {
		expect(
			eventDateAfterOccasionChange(
				WISHLIST_OCCASION.birthday,
				{ eventDate: new Date(2026, 11, 24), eventDatePrefilled: true },
				now,
			),
		).toEqual({ eventDate: null, eventDatePrefilled: false });
	});
});

describe('suggestWishlistThemeId', () => {
	it('suggests the christmas motif for Vánoce whatever the title', () => {
		expect(
			suggestWishlistThemeId({
				occasion: WISHLIST_OCCASION.christmas,
				title: 'Dárky',
				eventDate: null,
			}),
		).toBe('christmas');
	});

	it('falls back to the title for occasions without a motif', () => {
		expect(
			suggestWishlistThemeId({
				occasion: WISHLIST_OCCASION.other,
				title: 'Vánoce u babičky',
				eventDate: null,
			}),
		).toBe('christmas');
	});
});

describe('occasionHasCardBadge', () => {
	it('badges every occasion except Jiná and the Stálý seznam', () => {
		const badged = WISHLIST_OCCASIONS.filter(occasionHasCardBadge);

		expect(badged).toEqual([
			WISHLIST_OCCASION.christmas,
			WISHLIST_OCCASION.birthday,
			WISHLIST_OCCASION.nameDay,
			WISHLIST_OCCASION.wedding,
			WISHLIST_OCCASION.baby,
			WISHLIST_OCCASION.graduation,
		]);
	});
});
