import { describe, it, expect } from 'vitest';
import type { GiftForVisitor, GiftByRole } from './types.js';
import { GIFT_SORT_OPTIONS } from './types.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import {
	GIFT_SECTION_KINDS,
	computeGiftSections,
	computeUnprioritizedRank,
	giftSectionHasHeader,
	sortGifts,
	type GiftSection,
} from './gift_ordering.js';

let idCounter = 0;

function makeGift(overrides: Partial<GiftForVisitor> = {}): GiftForVisitor {
	idCounter += 1;
	return {
		id: `gift-${idCounter}`,
		wishlistId: 'wishlist-1',
		name: `Gift ${idCounter}`,
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: idCounter,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		...overrides,
	};
}

/** All gift ids across every section, in flattened render order. */
function flatIds(sections: GiftSection[]): string[] {
	return sections.flatMap((section) => section.gifts.map((gift) => gift.id));
}

const LOCALE = 'cs';

describe('computeGiftSections — bands (grouping off)', () => {
	it('pins the visitor own reservation to the first section, appearing exactly once (behavior 1)', () => {
		const mine = makeGift({ id: 'mine', myReservationId: 'res-1', isFullyReserved: true });
		const other = makeGift({ id: 'other' });
		const sections = computeGiftSections(
			[other, mine],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		expect(sections[0].gifts.map((g) => g.id)).toEqual(['mine']);
		expect(flatIds(sections).filter((id) => id === 'mine')).toHaveLength(1);
	});

	it('sinks fully-reserved-not-mine gifts below every available gift, under every sort (behavior 2)', () => {
		const available1 = makeGift({ id: 'a1', price: 300, name: 'B', sortOrder: 5 });
		const available2 = makeGift({ id: 'a2', price: 100, name: 'A', sortOrder: 1 });
		const reserved1 = makeGift({
			id: 'r1',
			price: 200,
			name: 'C',
			sortOrder: 2,
			isFullyReserved: true,
		});
		const reserved2 = makeGift({
			id: 'r2',
			price: 400,
			name: 'D',
			sortOrder: 8,
			isFullyReserved: true,
		});
		const gifts = [available1, reserved1, available2, reserved2];

		for (const sortOption of Object.values(GIFT_SORT_OPTIONS)) {
			const sections = computeGiftSections(
				gifts,
				WISHLIST_ROLES.visitor,
				sortOption,
				false,
				LOCALE,
			);
			const order = flatIds(sections);
			const lastAvailable = Math.max(order.indexOf('a1'), order.indexOf('a2'));
			const firstReserved = Math.min(order.indexOf('r1'), order.indexOf('r2'));
			expect(firstReserved).toBeGreaterThan(lastAvailable);
			// Bands never interleave: the reserved section is a single contiguous tail.
			const reservedSection = sections.find((s) => s.kind === GIFT_SECTION_KINDS.reserved);
			expect(reservedSection?.gifts.map((g) => g.id).sort()).toEqual(['r1', 'r2']);
		}
	});

	it('gives the moderator the own-reservation pin but keeps other reserved gifts in place (behavior 3)', () => {
		const mine = makeGift({
			id: 'mine',
			myReservationId: 'res-1',
			sortOrder: 3,
			isFullyReserved: true,
		});
		const reservedOther = makeGift({ id: 'other-res', sortOrder: 1, isFullyReserved: true });
		const available = makeGift({ id: 'avail', sortOrder: 2 });
		const sections = computeGiftSections(
			[reservedOther, available, mine],
			WISHLIST_ROLES.moderator,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		expect(sections[0].gifts.map((g) => g.id)).toEqual(['mine']);
		// No reserved section for a moderator — the foreign reserved gift keeps owner order.
		expect(sections.some((s) => s.kind === GIFT_SECTION_KINDS.reserved)).toBe(false);
		expect(flatIds(sections)).toEqual(['mine', 'other-res', 'avail']);
	});

	it('labels the band after an own-reservation band as „other gifts" for a visitor (behavior A1)', () => {
		const mine = makeGift({ id: 'mine', myReservationId: 'res-1' });
		const avail = makeGift({ id: 'avail' });
		const foreignReserved = makeGift({ id: 'fr', isFullyReserved: true });
		const sections = computeGiftSections(
			[avail, mine, foreignReserved],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		const otherBand = sections.find((s) => s.kind === GIFT_SECTION_KINDS.otherGifts);
		expect(otherBand?.gifts.map((g) => g.id)).toEqual(['avail']);
		expect(giftSectionHasHeader(otherBand!)).toBe(true);
		// The sunk foreign-reserved band stays headerless.
		const reservedBand = sections.find((s) => s.kind === GIFT_SECTION_KINDS.reserved);
		expect(reservedBand?.gifts.map((g) => g.id)).toEqual(['fr']);
		expect(giftSectionHasHeader(reservedBand!)).toBe(false);
	});

	it('labels the band after an own-reservation band as „other gifts" for a moderator (behavior A1)', () => {
		const mine = makeGift({ id: 'mine', myReservationId: 'res-1', sortOrder: 1 });
		const other = makeGift({ id: 'other', sortOrder: 2 });
		const sections = computeGiftSections(
			[mine, other],
			WISHLIST_ROLES.moderator,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		const otherBand = sections.find((s) => s.kind === GIFT_SECTION_KINDS.otherGifts);
		expect(otherBand?.gifts.map((g) => g.id)).toEqual(['other']);
		expect(giftSectionHasHeader(otherBand!)).toBe(true);
	});

	it('keeps the available band headerless when the viewer has no own reservation (behavior A2)', () => {
		const avail = makeGift({ id: 'avail' });
		const foreignReserved = makeGift({ id: 'fr', isFullyReserved: true });
		const sections = computeGiftSections(
			[avail, foreignReserved],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections.some((s) => s.kind === GIFT_SECTION_KINDS.otherGifts)).toBe(false);
		const availBand = sections.find((s) => s.kind === GIFT_SECTION_KINDS.available);
		expect(availBand?.gifts.map((g) => g.id)).toEqual(['avail']);
		expect(giftSectionHasHeader(availBand!)).toBe(false);
	});

	it('emits no other-gifts band when grouping is on, even with an own reservation (behavior A3)', () => {
		const mine = makeGift({
			id: 'mine',
			myReservationId: 'res-1',
			priorityLevelId: 'lvl-high',
			priorityLabel: 'Vysoká',
			prioritySortOrder: 1,
		});
		const med = makeGift({
			id: 'm',
			priorityLevelId: 'lvl-med',
			priorityLabel: 'Střední',
			prioritySortOrder: 2,
		});
		const sections = computeGiftSections(
			[med, mine],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			true,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		expect(sections.some((s) => s.kind === GIFT_SECTION_KINDS.otherGifts)).toBe(false);
	});

	it('gives the recipient one headerless section in input order (behavior 4)', () => {
		const g1 = makeGift({ id: 'g1', sortOrder: 2 });
		const g2 = makeGift({ id: 'g2', sortOrder: 1 });
		const g3 = makeGift({ id: 'g3', sortOrder: 3 });
		const input: GiftByRole[] = [g1, g2, g3];
		const sections = computeGiftSections(
			input,
			WISHLIST_ROLES.recipient,
			GIFT_SORT_OPTIONS.ownerOrder,
			false,
			LOCALE,
		);

		expect(sections).toHaveLength(1);
		expect(sections[0].label).toBeNull();
		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.available);
		// ownerOrder sort applied: g2(1), g1(2), g3(3).
		expect(flatIds(sections)).toEqual(['g2', 'g1', 'g3']);
	});
});

describe('computeGiftSections — priority grouping (grouping on)', () => {
	const high = { priorityLevelId: 'lvl-high', priorityLabel: 'Vysoká', prioritySortOrder: 1 };
	const medium = { priorityLevelId: 'lvl-med', priorityLabel: 'Střední', prioritySortOrder: 2 };
	const low = { priorityLevelId: 'lvl-low', priorityLabel: 'Nízká', prioritySortOrder: 3 };

	it('orders groups by level order with Bez priority directly above the lowest level (behavior 5)', () => {
		const gHigh = makeGift({ id: 'h', ...high });
		const gMed = makeGift({ id: 'm', ...medium });
		const gLow = makeGift({ id: 'l', ...low });
		const gNone = makeGift({ id: 'n' });
		const sections = computeGiftSections(
			[gLow, gNone, gHigh, gMed],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			true,
			LOCALE,
		);

		const kinds = sections.map((s) => s.kind);
		const labels = sections.map((s) => s.label);
		expect(kinds).toEqual([
			GIFT_SECTION_KINDS.priorityGroup,
			GIFT_SECTION_KINDS.priorityGroup,
			GIFT_SECTION_KINDS.noPriority,
			GIFT_SECTION_KINDS.priorityGroup,
		]);
		// High, Medium, then Bez priority, then the lowest level (Nízká) last.
		expect(labels[0]).toBe('Vysoká');
		expect(labels[1]).toBe('Střední');
		expect(labels[3]).toBe('Nízká');
		expect(flatIds(sections)).toEqual(['h', 'm', 'n', 'l']);
	});

	it('keeps the own-reservation band above all priority groups (behavior 6)', () => {
		const mine = makeGift({ id: 'mine', myReservationId: 'res-1', ...high });
		const gMed = makeGift({ id: 'm', ...medium });
		const sections = computeGiftSections(
			[gMed, mine],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			true,
			LOCALE,
		);

		expect(sections[0].kind).toBe(GIFT_SECTION_KINDS.ownReservation);
		expect(sections[0].gifts.map((g) => g.id)).toEqual(['mine']);
		expect(sections.slice(1).every((s) => s.kind === GIFT_SECTION_KINDS.priorityGroup)).toBe(
			true,
		);
	});

	it('sinks fully-reserved-not-mine gifts within each group for a visitor (behavior 7)', () => {
		const availHigh = makeGift({ id: 'ah', ...high });
		const resHigh = makeGift({ id: 'rh', ...high, isFullyReserved: true });
		const sections = computeGiftSections(
			[resHigh, availHigh],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.ownerOrder,
			true,
			LOCALE,
		);

		const highGroup = sections.find((s) => s.label === 'Vysoká');
		expect(highGroup?.gifts.map((g) => g.id)).toEqual(['ah', 'rh']);
	});

	it('does NOT sink reserved gifts within groups for a moderator (behavior 7, moderator excepted)', () => {
		const availHigh = makeGift({ id: 'ah', ...high, sortOrder: 2 });
		const resHigh = makeGift({ id: 'rh', ...high, sortOrder: 1, isFullyReserved: true });
		const sections = computeGiftSections(
			[resHigh, availHigh],
			WISHLIST_ROLES.moderator,
			GIFT_SORT_OPTIONS.ownerOrder,
			true,
			LOCALE,
		);

		const highGroup = sections.find((s) => s.label === 'Vysoká');
		// Owner order preserved (sortOrder 1 then 2) — no sinking.
		expect(highGroup?.gifts.map((g) => g.id)).toEqual(['rh', 'ah']);
	});
});

describe('priority rank for unprioritized gifts', () => {
	const high = { priorityLevelId: 'lvl-high', priorityLabel: 'Vysoká', prioritySortOrder: 1 };
	const medium = { priorityLevelId: 'lvl-med', priorityLabel: 'Střední', prioritySortOrder: 2 };
	const low = { priorityLevelId: 'lvl-low', priorityLabel: 'Nízká', prioritySortOrder: 3 };

	it('ranks unprioritized just above the lowest present level, not last (behavior 8)', () => {
		const gifts = [
			makeGift({ id: 'h', ...high }),
			makeGift({ id: 'm', ...medium }),
			makeGift({ id: 'l', ...low }),
			makeGift({ id: 'n' }),
		];
		const sorted = sortGifts(gifts, GIFT_SORT_OPTIONS.priority, LOCALE);
		// Unprioritized 'n' sits above the lowest level 'l', below 'm'.
		expect(sorted.map((g) => g.id)).toEqual(['h', 'm', 'n', 'l']);
	});

	it('computeUnprioritizedRank returns just below the max present sort order', () => {
		const gifts = [makeGift({ ...high }), makeGift({ ...medium }), makeGift({ ...low })];
		expect(computeUnprioritizedRank(gifts)).toBe(2.5);
	});

	it('returns 0 when no gift carries a priority', () => {
		expect(computeUnprioritizedRank([makeGift(), makeGift()])).toBe(0);
	});
});
