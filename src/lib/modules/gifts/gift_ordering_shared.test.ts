import { describe, expect, it } from 'vitest';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { GIFT_LINK_GROUP_KIND } from './gift_link_group_kind.js';
import { GIFT_SECTION_KINDS, computeGiftSections, giftSectionHasHeader } from './gift_ordering.js';
import { flatIds, LOCALE, makeGift, recipientShapedGift } from './gift_ordering.test_fixtures.js';
import { GIFT_GROUPING_OPTIONS, GIFT_SORT_OPTIONS } from './types.js';

const SHARED = {
	linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
	sharedWith: [
		{
			recipientDisplayName: 'Anička',
			recipientImage: null,
			giftId: null,
			wishlistId: null,
			wishlistShortId: null,
			wishlistTitle: null,
		},
	],
};

const high = { priorityLevelId: 'lvl-high', priorityLabel: 'Vysoká', prioritySortOrder: 1 };

describe('computeGiftSections — shared gifts (issue #737)', () => {
	it.each([
		GIFT_GROUPING_OPTIONS.none,
		GIFT_GROUPING_OPTIONS.priority,
		GIFT_GROUPING_OPTIONS.category,
	])(
		'puts shared gifts in their own headed section after own gifts with grouping %s',
		(grouping) => {
			const sections = computeGiftSections(
				[
					makeGift({ id: 'shared', ...SHARED, ...high }),
					makeGift({ id: 'own', ...high }),
					makeGift({ id: 'received', received: true }),
				],
				WISHLIST_ROLES.recipient,
				GIFT_SORT_OPTIONS.priority,
				grouping,
				LOCALE,
			);

			const sharedSection = sections.find(
				(section) => section.kind === GIFT_SECTION_KINDS.shared,
			);
			expect(sharedSection?.gifts.map((gift) => gift.id)).toEqual(['shared']);
			expect(sharedSection !== undefined && giftSectionHasHeader(sharedSection)).toBe(true);
			expect(flatIds(sections)).toEqual(['own', 'shared', 'received']);
		},
	);

	it('sinks fully reserved shared gifts inside the section for visitors', () => {
		const sections = computeGiftSections(
			[
				makeGift({
					id: 'shared-reserved',
					...SHARED,
					isFullyReserved: true,
					reservedCount: 1,
				}),
				makeGift({ id: 'shared-open', ...SHARED }),
				makeGift({ id: 'own' }),
			],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.none,
			LOCALE,
		);

		expect(sections.map((section) => section.kind)).toEqual([
			GIFT_SECTION_KINDS.available,
			GIFT_SECTION_KINDS.shared,
		]);
		expect(flatIds(sections)).toEqual(['own', 'shared-open', 'shared-reserved']);
	});

	it('keeps a shared gift the visitor reserved pinned with their reservations', () => {
		const sections = computeGiftSections(
			[
				makeGift({ id: 'mine', ...SHARED, myReservationId: 'reservation-1' }),
				makeGift({ id: 'own' }),
			],
			WISHLIST_ROLES.visitor,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.none,
			LOCALE,
		);

		expect(sections[0]).toMatchObject({ kind: GIFT_SECTION_KINDS.ownReservation });
		expect(sections[0].gifts.map((gift) => gift.id)).toEqual(['mine']);
		expect(sections.some((section) => section.kind === GIFT_SECTION_KINDS.shared)).toBe(false);
	});

	it('places recipient-shaped shared gifts among visitor-shaped gifts without pinning or sinking them', () => {
		const sections = computeGiftSections(
			[
				recipientShapedGift(makeGift({ id: 'shared-recipient', ...SHARED })),
				makeGift({ id: 'reserved', isFullyReserved: true, reservedCount: 1 }),
				makeGift({ id: 'own' }),
			],
			WISHLIST_ROLES.moderator,
			GIFT_SORT_OPTIONS.priority,
			GIFT_GROUPING_OPTIONS.none,
			LOCALE,
		);

		expect(sections.map((section) => section.kind)).toEqual([
			GIFT_SECTION_KINDS.available,
			GIFT_SECTION_KINDS.shared,
		]);
		expect(flatIds(sections)).toEqual(['reserved', 'own', 'shared-recipient']);
	});
});
