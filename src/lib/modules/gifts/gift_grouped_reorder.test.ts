import { describe, expect, it } from 'vitest';
import {
	applyReorderPlacement,
	buildReorderSections,
	categoryReorderGroups,
	giftReorderGroupKey,
	keyboardReorderPlacement,
	mergeReorderGiftsInputs,
	priorityReorderGroups,
	reorderGroupKey,
	resolveGroupedReorderMove,
	withReorderGroup,
} from './gift_grouped_reorder.js';
import { GIFT_GROUPING_OPTIONS, type GiftByRole } from './types.js';
import { GIFT_SECTION_KINDS } from './gift_ordering.js';

const PRIORITY = GIFT_GROUPING_OPTIONS.priority;
const CATEGORY = GIFT_GROUPING_OPTIONS.category;
const HIGH = reorderGroupKey(PRIORITY, 'high');
const LOW = reorderGroupKey(PRIORITY, 'low');
const MEDIUM = reorderGroupKey(PRIORITY, 'medium');
const NO_PRIORITY = reorderGroupKey(PRIORITY, null);

const LEVELS = [
	{ id: 'low', label: 'low', sortOrder: 2 },
	{ id: 'high', label: 'high', sortOrder: 0 },
	{ id: 'medium', label: 'medium', sortOrder: 1 },
];
const GROUPS = priorityReorderGroups(LEVELS);

function giftWithPriority(id: string, levelId: string | null, sortOrder: number): GiftByRole {
	const level = LEVELS.find((candidate) => candidate.id === levelId);
	return {
		id,
		wishlistId: 'wishlist',
		name: id,
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
		sortOrder,
		received: false,
		createdAt: new Date('2026-01-01'),
		priorityLevelId: level?.id ?? null,
		priorityLabel: level?.label ?? null,
		prioritySortOrder: level?.sortOrder ?? null,
		categoryId: null,
		category: null,
	};
}

/** Global order a1, b1, a2, b2, a3 where a* are high priority and b* low priority. */
const GLOBAL_ORDER = ['a1', 'b1', 'a2', 'b2', 'a3'];
const GROUP_BY_GIFT: Record<string, string> = {
	a1: HIGH,
	a2: HIGH,
	a3: HIGH,
	b1: LOW,
	b2: LOW,
};
const groupOf = (giftId: string) => GROUP_BY_GIFT[giftId]!;

function sectionIds(orderedIds: readonly string[], groupKeyOf = groupOf) {
	const gifts = orderedIds.map((id, index) =>
		giftWithPriority(id, groupKeyOf(id).replace('priority:', ''), index),
	);
	return buildReorderSections(gifts, PRIORITY, GROUPS).map((section) => ({
		key: section.key,
		ids: section.gifts.map((gift) => gift.id),
	}));
}

describe('grouped reorder sections', () => {
	it('shows every priority level in level order with "Bez priority" last, empty or not', () => {
		expect(sectionIds(GLOBAL_ORDER)).toEqual([
			{ key: HIGH, ids: ['a1', 'a2', 'a3'] },
			{ key: MEDIUM, ids: [] },
			{ key: LOW, ids: ['b1', 'b2'] },
			{ key: NO_PRIORITY, ids: [] },
		]);
		expect(GROUPS.at(-1)?.kind).toBe(GIFT_SECTION_KINDS.noPriority);
	});

	it('orders categories by their category order with "Bez kategorie" last', () => {
		const groups = categoryReorderGroups(
			[
				{
					id: 'toys',
					presetKey: null,
					customLabel: 'Toys',
					color: '#112233',
					sortOrder: 1,
				},
				{
					id: 'books',
					presetKey: null,
					customLabel: 'Books',
					color: '#112233',
					sortOrder: 0,
				},
			],
			'cs',
		);
		expect(groups.map((group) => [group.key, group.label])).toEqual([
			[reorderGroupKey(CATEGORY, 'books'), 'Books'],
			[reorderGroupKey(CATEGORY, 'toys'), 'Toys'],
			[reorderGroupKey(CATEGORY, null), null],
		]);
	});

	it('derives a gift group key from its priority or category', () => {
		const gift = giftWithPriority('a', 'high', 0);
		expect(giftReorderGroupKey(gift, PRIORITY)).toBe(HIGH);
		expect(giftReorderGroupKey(gift, CATEGORY)).toBe(reorderGroupKey(CATEGORY, null));
		expect(giftReorderGroupKey(giftWithPriority('b', null, 0), PRIORITY)).toBe(NO_PRIORITY);
	});

	it('applies a target group to a gift for optimistic display', () => {
		const lowGroup = GROUPS.find((group) => group.key === LOW)!;
		expect(withReorderGroup(giftWithPriority('a', 'high', 0), lowGroup)).toMatchObject({
			priorityLevelId: 'low',
			priorityLabel: 'low',
			prioritySortOrder: 2,
		});
	});
});

describe('applyReorderPlacement within a group', () => {
	it('permutes only the global slots the group already occupies', () => {
		const result = applyReorderPlacement(GLOBAL_ORDER, groupOf, {
			giftId: 'a3',
			groupKey: HIGH,
			index: 0,
		});

		// The ungrouped view shows a3, a1, a2 in their new relative order in the high slots,
		// while b1 and b2 keep their global positions.
		expect(result).toEqual(['a3', 'b1', 'a1', 'b2', 'a2']);
		expect(sectionIds(result)[0]).toEqual({ key: HIGH, ids: ['a3', 'a1', 'a2'] });
	});

	it('returns the original order when the gift stays in place', () => {
		expect(
			applyReorderPlacement(GLOBAL_ORDER, groupOf, {
				giftId: 'a2',
				groupKey: HIGH,
				index: 1,
			}),
		).toEqual(GLOBAL_ORDER);
	});
});

describe('applyReorderPlacement across groups', () => {
	it('inserts the gift directly before its new next neighbour in the target group', () => {
		const result = applyReorderPlacement(GLOBAL_ORDER, groupOf, {
			giftId: 'a3',
			groupKey: LOW,
			index: 1,
		});
		expect(result).toEqual(['a1', 'b1', 'a2', 'a3', 'b2']);
	});

	it('inserts the gift directly after its previous neighbour when it lands last', () => {
		const result = applyReorderPlacement(GLOBAL_ORDER, groupOf, {
			giftId: 'a1',
			groupKey: LOW,
			index: 2,
		});
		expect(result).toEqual(['b1', 'a2', 'b2', 'a1', 'a3']);
	});

	it('keeps the remaining source group gifts in their positions relative to each other', () => {
		const result = applyReorderPlacement(GLOBAL_ORDER, groupOf, {
			giftId: 'a2',
			groupKey: LOW,
			index: 0,
		});
		expect(result.filter((id) => id !== 'a2' && groupOf(id) === HIGH)).toEqual(['a1', 'a3']);
		expect(result.indexOf('a1')).toBe(GLOBAL_ORDER.indexOf('a1'));
		expect(result.indexOf('a3')).toBe(GLOBAL_ORDER.indexOf('a3'));
		expect(result).toEqual(['a1', 'a2', 'b1', 'b2', 'a3']);
	});

	it('keeps the global position when the target group is empty', () => {
		expect(
			applyReorderPlacement(GLOBAL_ORDER, groupOf, {
				giftId: 'b1',
				groupKey: MEDIUM,
				index: 0,
			}),
		).toEqual(GLOBAL_ORDER);
	});
});

describe('ungrouped reorder seen in grouped view', () => {
	it('changes a group only where gifts of that group passed each other', () => {
		// Moving a1 past b1 and a2 in the ungrouped view.
		const ungroupedMove = ['b1', 'a2', 'a1', 'b2', 'a3'];
		expect(sectionIds(ungroupedMove)).toEqual([
			{ key: HIGH, ids: ['a2', 'a1', 'a3'] },
			{ key: MEDIUM, ids: [] },
			{ key: LOW, ids: ['b1', 'b2'] },
			{ key: NO_PRIORITY, ids: [] },
		]);

		// Moving b2 past only high-priority gifts leaves every group order unchanged.
		expect(sectionIds(['a1', 'b1', 'b2', 'a2', 'a3'])).toEqual(sectionIds(GLOBAL_ORDER));
	});
});

describe('keyboardReorderPlacement', () => {
	const sections = buildReorderSections(
		GLOBAL_ORDER.map((id, index) =>
			giftWithPriority(id, groupOf(id).replace('priority:', ''), index),
		),
		PRIORITY,
		GROUPS,
	);

	it('moves within the group away from its edges', () => {
		expect(keyboardReorderPlacement(sections, 'a2', 1)).toEqual({
			giftId: 'a2',
			groupKey: HIGH,
			index: 2,
		});
	});

	it('carries the last gift of a group down to the first place of the next group, even an empty one', () => {
		expect(keyboardReorderPlacement(sections, 'a3', 1)).toEqual({
			giftId: 'a3',
			groupKey: MEDIUM,
			index: 0,
		});
		expect(keyboardReorderPlacement(sections, 'b2', 1)).toEqual({
			giftId: 'b2',
			groupKey: NO_PRIORITY,
			index: 0,
		});
	});

	it('carries the first gift of a group up to the last place of the previous group', () => {
		expect(keyboardReorderPlacement(sections, 'b1', -1)).toEqual({
			giftId: 'b1',
			groupKey: MEDIUM,
			index: 0,
		});
		const withoutEmptyMedium = sections.filter((section) => section.key !== MEDIUM);
		expect(keyboardReorderPlacement(withoutEmptyMedium, 'b1', -1)).toEqual({
			giftId: 'b1',
			groupKey: HIGH,
			index: 3,
		});
	});

	it('cannot move past the overall first or last position', () => {
		expect(keyboardReorderPlacement(sections, 'a1', -1)).toBeNull();
		const withoutTrailingGroup = sections.filter((section) => section.key !== NO_PRIORITY);
		expect(keyboardReorderPlacement(withoutTrailingGroup, 'b2', 1)).toBeNull();
	});
});

describe('mergeReorderGiftsInputs', () => {
	it('keeps the latest order and every gift group change, latest per gift', () => {
		expect(
			mergeReorderGiftsInputs(
				{
					wishlistId: 'wishlist',
					orderedGiftIds: ['a', 'b'],
					groupChanges: [
						{ giftId: 'a', field: PRIORITY, value: 'high' },
						{ giftId: 'b', field: PRIORITY, value: 'low' },
					],
				},
				{
					wishlistId: 'wishlist',
					orderedGiftIds: ['b', 'a'],
					groupChanges: [{ giftId: 'a', field: PRIORITY, value: null }],
				},
			),
		).toEqual({
			wishlistId: 'wishlist',
			orderedGiftIds: ['b', 'a'],
			groupChanges: [
				{ giftId: 'a', field: PRIORITY, value: null },
				{ giftId: 'b', field: PRIORITY, value: 'low' },
			],
		});
	});

	it('omits group changes when neither value has any', () => {
		expect(
			mergeReorderGiftsInputs(
				{ wishlistId: 'wishlist', orderedGiftIds: ['a', 'b'] },
				{ wishlistId: 'wishlist', orderedGiftIds: ['b', 'a'] },
			),
		).toEqual({ wishlistId: 'wishlist', orderedGiftIds: ['b', 'a'] });
	});
});

describe('resolveGroupedReorderMove', () => {
	const gifts = GLOBAL_ORDER.map((id, index) =>
		giftWithPriority(id, groupOf(id).replace('priority:', ''), index),
	);
	const groupsByKey = new Map(GROUPS.map((group) => [group.key, group]));

	it('reorders within a group without changing any gift group', () => {
		const move = resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
			giftId: 'a3',
			groupKey: HIGH,
			index: 0,
		});
		expect(move).toMatchObject({
			orderedIds: ['a3', 'b1', 'a1', 'b2', 'a2'],
			previousOrder: GLOBAL_ORDER,
			targetGroup: null,
			groupChanges: [],
		});
		expect(move?.movedGift.id).toBe('a3');
	});

	it('moves a gift into another group together with the matching priority change', () => {
		const move = resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
			giftId: 'a3',
			groupKey: LOW,
			index: 1,
		});
		expect(move).toMatchObject({
			orderedIds: ['a1', 'b1', 'a2', 'a3', 'b2'],
			// The order before the drop is what "Vrátit" restores.
			previousOrder: GLOBAL_ORDER,
			targetGroup: { key: LOW },
			groupChanges: [{ giftId: 'a3', field: PRIORITY, value: 'low' }],
		});
	});

	it('lets an empty "Bez priority" group receive a gift, keeping its global position', () => {
		expect(
			resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
				giftId: 'b2',
				groupKey: NO_PRIORITY,
				index: 0,
			}),
		).toMatchObject({
			orderedIds: GLOBAL_ORDER,
			targetGroup: { key: NO_PRIORITY },
			groupChanges: [{ giftId: 'b2', field: PRIORITY, value: null }],
		});
	});

	it('moves a gift into another category the same way', () => {
		const books = {
			id: 'books',
			presetKey: null,
			customLabel: 'Books',
			color: '#112233',
			sortOrder: 0,
		};
		const withBooks = (gift: GiftByRole): GiftByRole => ({
			...gift,
			categoryId: books.id,
			category: books,
		});
		const categoryGifts = [
			withBooks(giftWithPriority('x1', null, 0)),
			giftWithPriority('y1', null, 1),
			withBooks(giftWithPriority('x2', null, 2)),
		];
		const categoryGroups = categoryReorderGroups([books], 'cs');
		const move = resolveGroupedReorderMove(
			categoryGifts,
			CATEGORY,
			new Map(categoryGroups.map((group) => [group.key, group])),
			{ giftId: 'y1', groupKey: reorderGroupKey(CATEGORY, 'books'), index: 2 },
		);
		expect(move).toMatchObject({
			orderedIds: ['x1', 'x2', 'y1'],
			groupChanges: [{ giftId: 'y1', field: CATEGORY, value: 'books' }],
		});
	});

	it('ignores a drop that changes neither the order nor the group', () => {
		expect(
			resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
				giftId: 'a2',
				groupKey: HIGH,
				index: 1,
			}),
		).toBeNull();
	});

	it('rejects an unknown gift or a target group that is not shown', () => {
		expect(
			resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
				giftId: 'missing',
				groupKey: HIGH,
				index: 0,
			}),
		).toBeNull();
		expect(
			resolveGroupedReorderMove(gifts, PRIORITY, groupsByKey, {
				giftId: 'a1',
				groupKey: reorderGroupKey(PRIORITY, 'deleted'),
				index: 0,
			}),
		).toBeNull();
	});
});
