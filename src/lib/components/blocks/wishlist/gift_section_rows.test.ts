import { describe, expect, it } from 'vitest';
import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { toGiftCarouselRows, toGiftDisplayRows } from './gift_section_rows.js';

function section(kind: GiftSection['kind'], key: string, giftIds: string[]): GiftSection {
	return {
		kind,
		key,
		label: kind === GIFT_SECTION_KINDS.categoryGroup ? key : null,
		gifts: giftIds.map((id) => ({ id }) as GiftByRole),
	};
}

function carouselRowsOf(sections: GiftSection[]) {
	return toGiftCarouselRows(toGiftDisplayRows(sections)).map((row) => ({
		key: row.key,
		giftIds: row.giftRows.map((giftRow) => giftRow.gift.id),
	}));
}

describe('toGiftCarouselRows (#580 REQ-4)', () => {
	it('gives every headed group its own row', () => {
		expect(
			carouselRowsOf([
				section(GIFT_SECTION_KINDS.categoryGroup, 'Knihy', ['a', 'b']),
				section(GIFT_SECTION_KINDS.categoryGroup, 'Hry', ['c']),
				section(GIFT_SECTION_KINDS.received, 'received', ['d']),
			]),
		).toEqual([
			{ key: 'Knihy', giftIds: ['a', 'b'] },
			{ key: 'Hry', giftIds: ['c'] },
			{ key: 'received', giftIds: ['d'] },
		]);
	});

	it('shows an ungrouped list with sunk reservations as a single row', () => {
		expect(
			carouselRowsOf([
				section(GIFT_SECTION_KINDS.available, 'available', ['a', 'b']),
				section(GIFT_SECTION_KINDS.reserved, 'reserved', ['c']),
			]),
		).toEqual([{ key: 'available', giftIds: ['a', 'b', 'c'] }]);
	});

	it('keeps sunk reservations in the row of the header above them', () => {
		expect(
			carouselRowsOf([
				section(GIFT_SECTION_KINDS.ownReservation, 'ownReservation', ['a']),
				section(GIFT_SECTION_KINDS.otherGifts, 'otherGifts', ['b']),
				section(GIFT_SECTION_KINDS.reserved, 'reserved', ['c']),
			]),
		).toEqual([
			{ key: 'ownReservation', giftIds: ['a'] },
			{ key: 'otherGifts', giftIds: ['b', 'c'] },
		]);
	});

	it('skips empty groups', () => {
		expect(
			carouselRowsOf([
				section(GIFT_SECTION_KINDS.categoryGroup, 'Knihy', []),
				section(GIFT_SECTION_KINDS.categoryGroup, 'Hry', ['a']),
			]),
		).toEqual([{ key: 'Hry', giftIds: ['a'] }]);
	});
});
