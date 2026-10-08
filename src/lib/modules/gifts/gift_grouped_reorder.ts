import {
	GIFT_GROUPING_OPTIONS,
	type GiftByRole,
	type GiftReorderGroupField,
	type ReorderGiftGroupChange,
	type ReorderGiftsInput,
} from './types.js';
import { GIFT_SECTION_KINDS, type GiftSection, type GiftSectionKind } from './gift_ordering.js';
import { getPriorityKey, type PriorityKey } from './gift_display.js';
import {
	labelForGiftCategory,
	type PublicGiftCategory,
} from '$lib/modules/gift-categories/types.js';

/**
 * Grouped manual reorder (issue #454). Manual order stays one global order; these pure helpers
 * derive the grouped view from it and translate grouped moves back into that global order.
 */

/** One priority level or category (or its "Bez …" group) shown while reordering. */
export interface GiftReorderGroup {
	key: string;
	field: GiftReorderGroupField;
	/** Priority level or category id; null for "Bez priority" / "Bez kategorie". */
	value: string | null;
	kind: GiftSectionKind;
	label: string | null;
	priorityKey: PriorityKey | null;
	prioritySortOrder: number | null;
	category: PublicGiftCategory | null;
}

/** Where a moved gift ends up: its group and its index among that group's other gifts. */
export interface GiftReorderPlacement {
	giftId: string;
	groupKey: string;
	index: number;
}

/** Pointer drops that change a group offer an undo toast; keyboard moves only announce. */
export const GIFT_REORDER_MOVE_SOURCES = {
	pointer: 'pointer',
	keyboard: 'keyboard',
} as const;
export type GiftReorderMoveSource =
	(typeof GIFT_REORDER_MOVE_SOURCES)[keyof typeof GIFT_REORDER_MOVE_SOURCES];

export function reorderGroupKey(field: GiftReorderGroupField, value: string | null): string {
	return `${field}:${value ?? 'none'}`;
}

export function giftReorderGroupKey(gift: GiftByRole, field: GiftReorderGroupField): string {
	if (field === GIFT_GROUPING_OPTIONS.priority) {
		return reorderGroupKey(
			field,
			gift.priorityLevelId !== null && gift.prioritySortOrder !== null
				? gift.priorityLevelId
				: null,
		);
	}
	return reorderGroupKey(
		field,
		gift.categoryId != null && gift.category != null ? gift.categoryId : null,
	);
}

export function priorityReorderGroups(
	levels: readonly { id: string; label: string; sortOrder: number }[],
): GiftReorderGroup[] {
	const field = GIFT_GROUPING_OPTIONS.priority;
	return [
		...[...levels]
			.sort((first, second) => first.sortOrder - second.sortOrder)
			.map((level) => ({
				key: reorderGroupKey(field, level.id),
				field,
				value: level.id,
				kind: GIFT_SECTION_KINDS.priorityGroup,
				label: level.label,
				priorityKey: getPriorityKey(level.label),
				prioritySortOrder: level.sortOrder,
				category: null,
			})),
		{
			key: reorderGroupKey(field, null),
			field,
			value: null,
			kind: GIFT_SECTION_KINDS.noPriority,
			label: null,
			priorityKey: null,
			prioritySortOrder: null,
			category: null,
		},
	];
}

export function categoryReorderGroups(
	categories: readonly PublicGiftCategory[],
	locale: string,
): GiftReorderGroup[] {
	const field = GIFT_GROUPING_OPTIONS.category;
	const language = locale.startsWith('en') ? 'en' : 'cs';
	return [
		...[...categories]
			.sort((first, second) => first.sortOrder - second.sortOrder)
			.map((category) => ({
				key: reorderGroupKey(field, category.id),
				field,
				value: category.id,
				kind: GIFT_SECTION_KINDS.categoryGroup,
				label: labelForGiftCategory(category, language),
				priorityKey: null,
				prioritySortOrder: null,
				category: {
					id: category.id,
					presetKey: category.presetKey,
					customLabel: category.customLabel,
					color: category.color,
					sortOrder: category.sortOrder,
				},
			})),
		{
			key: reorderGroupKey(field, null),
			field,
			value: null,
			kind: GIFT_SECTION_KINDS.uncategorized,
			label: null,
			priorityKey: null,
			prioritySortOrder: null,
			category: null,
		},
	];
}

/** The gift as it looks once it belongs to `group`, for optimistic display. */
export function withReorderGroup<Gift extends GiftByRole>(
	gift: Gift,
	group: GiftReorderGroup,
): Gift {
	if (group.field === GIFT_GROUPING_OPTIONS.priority) {
		return {
			...gift,
			priorityLevelId: group.value,
			priorityLabel: group.label,
			prioritySortOrder: group.prioritySortOrder,
		};
	}
	return { ...gift, categoryId: group.value, category: group.category };
}

function reorderGroupChange(giftId: string, group: GiftReorderGroup): ReorderGiftGroupChange {
	return { giftId, field: group.field, value: group.value };
}

/**
 * Every group becomes a section, empty ones included so they can receive gifts; gifts keep the
 * global manual order inside their section.
 */
export function buildReorderSections(
	orderedGifts: readonly GiftByRole[],
	field: GiftReorderGroupField,
	groups: readonly GiftReorderGroup[],
): GiftSection[] {
	const sectionsByKey = new Map<string, GiftSection>(
		groups.map((group) => [
			group.key,
			{
				kind: group.kind,
				key: group.key,
				label: group.label,
				priorityKey: group.priorityKey,
				gifts: [],
			},
		]),
	);
	for (const gift of orderedGifts) {
		const key = giftReorderGroupKey(gift, field);
		let section = sectionsByKey.get(key);
		if (section === undefined) {
			// A level or category missing from the loaded definitions still shows its gifts.
			section = {
				kind:
					field === GIFT_GROUPING_OPTIONS.priority
						? GIFT_SECTION_KINDS.priorityGroup
						: GIFT_SECTION_KINDS.categoryGroup,
				key,
				label: field === GIFT_GROUPING_OPTIONS.priority ? gift.priorityLabel : null,
				priorityKey: getPriorityKey(gift.priorityLabel),
				gifts: [],
			};
			sectionsByKey.set(key, section);
		}
		section.gifts.push(gift);
	}
	return [...sectionsByKey.values()];
}

/**
 * Translates a grouped move into the global order. Within its group the gift only permutes the
 * global slots that group already occupies. Into another group it is inserted directly before its
 * new next neighbour there, else directly after its new previous neighbour, else (empty group) it
 * keeps its global position.
 */
export function applyReorderPlacement(
	orderedIds: readonly string[],
	groupKeyOf: (giftId: string) => string,
	placement: GiftReorderPlacement,
): string[] {
	const { giftId, groupKey, index } = placement;
	if (!orderedIds.includes(giftId)) {
		return [...orderedIds];
	}

	if (groupKeyOf(giftId) === groupKey) {
		const slots = orderedIds.flatMap((id, slot) => (groupKeyOf(id) === groupKey ? [slot] : []));
		const members = orderedIds.filter((id) => id !== giftId && groupKeyOf(id) === groupKey);
		members.splice(Math.min(Math.max(index, 0), members.length), 0, giftId);
		const result = [...orderedIds];
		slots.forEach((slot, memberIndex) => {
			result[slot] = members[memberIndex]!;
		});
		return result;
	}

	const remaining = orderedIds.filter((id) => id !== giftId);
	const targetMembers = remaining.filter((id) => groupKeyOf(id) === groupKey);
	const nextNeighbour = targetMembers[index];
	const previousNeighbour = targetMembers[index - 1];
	if (nextNeighbour !== undefined) {
		remaining.splice(remaining.indexOf(nextNeighbour), 0, giftId);
		return remaining;
	}
	if (previousNeighbour !== undefined) {
		remaining.splice(remaining.indexOf(previousNeighbour) + 1, 0, giftId);
		return remaining;
	}
	return [...orderedIds];
}

/** Looks up each gift's current group key by id; unknown ids map to no group. */
export function reorderGroupKeyLookup(
	gifts: readonly GiftByRole[],
	field: GiftReorderGroupField,
): (giftId: string) => string {
	const groupKeysById = new Map(gifts.map((gift) => [gift.id, giftReorderGroupKey(gift, field)]));
	return (giftId) => groupKeysById.get(giftId) ?? '';
}

/** A grouped placement resolved against the committed order, ready to persist. */
export interface GroupedReorderMove {
	movedGift: GiftByRole;
	previousOrder: string[];
	orderedIds: string[];
	/** The gift's new group; null when it stays in its own group. */
	targetGroup: GiftReorderGroup | null;
	groupChanges: ReorderGiftGroupChange[];
}

/**
 * Resolves a grouped placement into the new global order and the group change it implies. Null
 * when the gift or a changed target group is unknown, or the move changes neither order nor group.
 */
export function resolveGroupedReorderMove(
	orderedGifts: readonly GiftByRole[],
	field: GiftReorderGroupField,
	groupsByKey: ReadonlyMap<string, GiftReorderGroup>,
	placement: GiftReorderPlacement,
): GroupedReorderMove | null {
	const movedGift = orderedGifts.find((gift) => gift.id === placement.giftId);
	if (movedGift === undefined) {
		return null;
	}
	const groupChanged = giftReorderGroupKey(movedGift, field) !== placement.groupKey;
	const targetGroup = groupChanged ? groupsByKey.get(placement.groupKey) : null;
	if (targetGroup === undefined) {
		return null;
	}
	const previousOrder = orderedGifts.map((gift) => gift.id);
	const orderedIds = applyReorderPlacement(
		previousOrder,
		reorderGroupKeyLookup(orderedGifts, field),
		placement,
	);
	if (targetGroup === null && orderedIds.every((id, index) => id === previousOrder[index])) {
		return null;
	}
	return {
		movedGift,
		previousOrder,
		orderedIds,
		targetGroup,
		groupChanges: targetGroup === null ? [] : [reorderGroupChange(movedGift.id, targetGroup)],
	};
}

/**
 * One keyboard or button step in grouped reorder: within a group it moves by one; past a group
 * edge it enters the adjacent group in display order (empty groups included), arriving first when
 * moving down and last when moving up. Null only at the overall first or last position.
 */
export function keyboardReorderPlacement(
	sections: readonly Pick<GiftSection, 'key' | 'gifts'>[],
	giftId: string,
	direction: -1 | 1,
): GiftReorderPlacement | null {
	const sectionIndex = sections.findIndex((section) =>
		section.gifts.some((gift) => gift.id === giftId),
	);
	const section = sections[sectionIndex];
	if (section === undefined) {
		return null;
	}
	const indexInGroup = section.gifts.findIndex((gift) => gift.id === giftId);
	const targetIndex = indexInGroup + direction;
	if (targetIndex >= 0 && targetIndex < section.gifts.length) {
		return { giftId, groupKey: section.key, index: targetIndex };
	}
	const adjacentSection = sections[sectionIndex + direction];
	if (adjacentSection === undefined) {
		return null;
	}
	return {
		giftId,
		groupKey: adjacentSection.key,
		index: direction === 1 ? 0 : adjacentSection.gifts.length,
	};
}

/** Queue merge: the latest order wins while every pending group change survives, latest per gift. */
export function mergeReorderGiftsInputs(
	pending: ReorderGiftsInput,
	next: ReorderGiftsInput,
): ReorderGiftsInput {
	const changesByGiftId = new Map<string, ReorderGiftGroupChange>();
	for (const change of [...(pending.groupChanges ?? []), ...(next.groupChanges ?? [])]) {
		changesByGiftId.set(change.giftId, change);
	}
	const merged: ReorderGiftsInput = {
		wishlistId: next.wishlistId,
		orderedGiftIds: next.orderedGiftIds,
	};
	return changesByGiftId.size === 0
		? merged
		: { ...merged, groupChanges: [...changesByGiftId.values()] };
}
