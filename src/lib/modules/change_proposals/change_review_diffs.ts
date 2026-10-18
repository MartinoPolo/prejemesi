import * as m from '$lib/paraglide/messages.js';
import { formatPieceCount, formatPrice } from '$lib/modules/gifts/gift_display.js';
import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
import type { DescriptionAppend, GiftLink } from '$lib/modules/gifts/types.js';
import type { ChangeProposalGift } from './types.js';

export const GIFT_DIFF_FIELD = {
	gift: 'gift',
	name: 'name',
	description: 'description',
	price: 'price',
	quantity: 'quantity',
	category: 'category',
	priority: 'priority',
	image: 'image',
	link: 'link',
	received: 'received',
} as const;

export type GiftDiffField = (typeof GIFT_DIFF_FIELD)[keyof typeof GIFT_DIFF_FIELD];

/** One changed field: a null `before` is a new value only, a null `after` a removed one. */
export interface GiftFieldDiff {
	field: GiftDiffField;
	before: string | null;
	after: string | null;
}

/** Labels for the ids a gift snapshot carries; null when the id is unknown to the viewer. */
export interface GiftLabelLookups {
	categoryLabel: (categoryId: string) => string | null;
	priorityLabel: (priorityLevelId: string) => string | null;
}

/** Fields whose change alters how the gift card looks, so the row shows the cards. */
const CARD_FIELDS = new Set<GiftDiffField>([
	GIFT_DIFF_FIELD.name,
	GIFT_DIFF_FIELD.price,
	GIFT_DIFF_FIELD.quantity,
	GIFT_DIFF_FIELD.category,
	GIFT_DIFF_FIELD.priority,
	GIFT_DIFF_FIELD.image,
]);

export function isGiftDeletion(before: ChangeProposalGift | null, after: ChangeProposalGift) {
	return after.deleted && before !== null && !before.deleted;
}

function nonEmpty(text: string | null): string | null {
	const trimmed = text?.trim() ?? '';
	return trimmed === '' ? null : trimmed;
}

function linkText(link: GiftLink): string {
	const domain = extractGiftUrlDomain(link.url) ?? link.url;
	const label = nonEmpty(link.label ?? null);
	return label === null ? domain : `${domain} · ${label}`;
}

function linkDiffs(before: readonly GiftLink[], after: readonly GiftLink[]): GiftFieldDiff[] {
	const beforeUrls = new Set(before.map((link) => link.url));
	const afterUrls = new Set(after.map((link) => link.url));
	return [
		...before
			.filter((link) => !afterUrls.has(link.url))
			.map((link) => ({ field: GIFT_DIFF_FIELD.link, before: linkText(link), after: null })),
		...after
			.filter((link) => !beforeUrls.has(link.url))
			.map((link) => ({ field: GIFT_DIFF_FIELD.link, before: null, after: linkText(link) })),
	];
}

/** Each field's readable value, null when the gift has none. */
function giftFieldValues(
	gift: ChangeProposalGift,
	lookups: GiftLabelLookups,
): Record<Exclude<GiftDiffField, 'gift' | 'link'>, string | null> {
	return {
		name: gift.name,
		description: nonEmpty(gift.description),
		price: gift.price === null ? null : formatPrice(gift.price, gift.currency, gift.priceMax),
		quantity: formatPieceCount(gift.quantity, 'recipient')?.pieceText ?? null,
		category: gift.categoryId === null ? null : lookups.categoryLabel(gift.categoryId),
		priority:
			gift.priorityLevelId === null ? null : lookups.priorityLabel(gift.priorityLevelId),
		image: gift.imageUrl === null ? null : m.change_review_image_present(),
		received: gift.received ? m.change_review_received_yes() : null,
	};
}

const COMPARED_FIELDS = [
	GIFT_DIFF_FIELD.name,
	GIFT_DIFF_FIELD.description,
	GIFT_DIFF_FIELD.price,
	GIFT_DIFF_FIELD.quantity,
	GIFT_DIFF_FIELD.category,
	GIFT_DIFF_FIELD.priority,
	GIFT_DIFF_FIELD.image,
	GIFT_DIFF_FIELD.received,
] as const;

function imageText(imageUrl: string | null, presentText: () => string): string {
	return imageUrl === null ? m.change_review_image_none() : presentText();
}

function receivedText(received: boolean): string {
	return received ? m.change_review_received_yes() : m.change_review_received_no();
}

/** Image and received changes read as words; the other fields compare their display values. */
function changedFieldDiff(
	field: (typeof COMPARED_FIELDS)[number],
	before: ChangeProposalGift,
	after: ChangeProposalGift,
	lookups: GiftLabelLookups,
): GiftFieldDiff | null {
	if (field === GIFT_DIFF_FIELD.image) {
		return before.imageUrl === after.imageUrl
			? null
			: {
					field,
					before: imageText(before.imageUrl, m.change_review_image_previous),
					after: imageText(after.imageUrl, m.change_review_image_new),
				};
	}
	if (field === GIFT_DIFF_FIELD.received) {
		return before.received === after.received
			? null
			: { field, before: receivedText(before.received), after: receivedText(after.received) };
	}
	const beforeValue = giftFieldValues(before, lookups)[field];
	const afterValue = giftFieldValues(after, lookups)[field];
	if (beforeValue === afterValue) {
		return null;
	}
	return {
		field,
		before: beforeValue ?? m.change_review_value_none(),
		after: afterValue ?? m.change_review_value_none(),
	};
}

/**
 * What a row changes on one gift. A new gift lists its filled fields as new values, a deletion
 * names the gift as removed, and an edit pairs each changed field's old and new value.
 */
export function giftFieldDiffs(
	before: ChangeProposalGift | null,
	after: ChangeProposalGift,
	lookups: GiftLabelLookups,
): GiftFieldDiff[] {
	if (before === null) {
		const values = giftFieldValues(after, lookups);
		return [
			...COMPARED_FIELDS.flatMap((field) =>
				values[field] === null ? [] : [{ field, before: null, after: values[field] }],
			),
			...linkDiffs([], after.links),
		];
	}
	if (isGiftDeletion(before, after)) {
		return [{ field: GIFT_DIFF_FIELD.gift, before: before.name, after: null }];
	}
	return [
		...COMPARED_FIELDS.flatMap((field) => {
			const diff = changedFieldDiff(field, before, after, lookups);
			return diff === null ? [] : [diff];
		}),
		...linkDiffs(before.links, after.links),
	];
}

/** Appends the change adds below the immutable original description. */
export function appendedDescriptions(
	before: ChangeProposalGift | null,
	after: ChangeProposalGift,
): DescriptionAppend[] {
	return after.descriptionAppends.slice(before?.descriptionAppends.length ?? 0);
}

/** New and deleted gifts always show their card; edits only when the card itself changes. */
export function showsGiftCards(
	before: ChangeProposalGift | null,
	after: ChangeProposalGift,
	diffs: readonly GiftFieldDiff[],
): boolean {
	return (
		before === null ||
		isGiftDeletion(before, after) ||
		diffs.some((diff) => CARD_FIELDS.has(diff.field))
	);
}

export interface ReorderMove {
	giftId: string;
	name: string;
	fromPosition: number;
	toPosition: number;
	previousName: string | null;
	nextName: string | null;
}

/**
 * The gifts a reorder moves, by 1-based position. Gifts on the longest run that keeps its relative
 * order count as staying, so moving one gift does not list every gift it shifted.
 */
export function reorderMoves(
	orderedGiftIds: readonly string[],
	currentGifts: readonly { id: string; name: string }[],
): ReorderMove[] {
	const currentIndexById = new Map(currentGifts.map((gift, index) => [gift.id, index]));
	const nameById = new Map(currentGifts.map((gift) => [gift.id, gift.name]));
	const knownIds = orderedGiftIds.filter((giftId) => currentIndexById.has(giftId));
	const staying = longestIncreasingRun(knownIds.map((giftId) => currentIndexById.get(giftId)!));
	return knownIds.flatMap((giftId, index) =>
		staying.has(index)
			? []
			: [
					{
						giftId,
						name: nameById.get(giftId)!,
						fromPosition: currentIndexById.get(giftId)! + 1,
						toPosition: index + 1,
						previousName: index > 0 ? nameById.get(knownIds[index - 1]!)! : null,
						nextName:
							index < knownIds.length - 1
								? nameById.get(knownIds[index + 1]!)!
								: null,
					},
				],
	);
}

/** Indices of one longest strictly increasing subsequence (patience sorting). */
function longestIncreasingRun(values: readonly number[]): Set<number> {
	const tailIndices: number[] = [];
	const previousIndex: number[] = [];
	values.forEach((value, index) => {
		let low = 0;
		let high = tailIndices.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (values[tailIndices[middle]!]! < value) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}
		previousIndex[index] = low > 0 ? tailIndices[low - 1]! : -1;
		tailIndices[low] = index;
	});
	const run = new Set<number>();
	let cursor = tailIndices.at(-1) ?? -1;
	while (cursor !== -1) {
		run.add(cursor);
		cursor = previousIndex[cursor]!;
	}
	return run;
}
