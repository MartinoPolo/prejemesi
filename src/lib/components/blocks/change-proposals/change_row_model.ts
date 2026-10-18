import * as m from '$lib/paraglide/messages.js';
import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
import type { DescriptionAppend, GiftByRole, GiftForRecipient } from '$lib/modules/gifts/types.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import { translateServerErrorCode } from '$lib/modules/errors/translate_server_error.js';
import {
	CHANGE_KIND,
	type ChangeKind,
	type ChangeProposalGift,
	type ChangeProposalRowView,
	type ChangeRowConflict,
} from '$lib/modules/change_proposals/types.js';
import {
	appendedDescriptions,
	giftFieldDiffs,
	isGiftDeletion,
	reorderMoves,
	showsGiftCards,
	type GiftDiffField,
	type GiftLabelLookups,
} from '$lib/modules/change_proposals/change_review_diffs.js';
import { formatChangeReviewDateTime } from '$lib/modules/change_proposals/change_review_copy.js';
import {
	CHANGE_ROW_GROUP,
	changeRowGroup,
} from '$lib/modules/change_proposals/change_review_selection.js';

/** Reservation operations the page words differently; the server's operation policies own the full list. */
const RESERVATION_OPERATION = {
	reserve: 'reserveGift',
	cancel: 'cancelOwnReservation',
	markPurchased: 'setReservationPurchased',
} as const;

/** Moves listed on a reorder row before the rest collapse into a count. */
const REORDER_VISIBLE_MOVES = 5;

const FIELD_LABELS = {
	gift: m.change_review_field_gift,
	name: m.change_review_field_name,
	description: m.change_review_field_description,
	price: m.change_review_field_price,
	quantity: m.change_review_field_quantity,
	category: m.change_review_field_category,
	priority: m.change_review_field_priority,
	image: m.change_review_field_image,
	link: m.change_review_field_link,
	received: m.change_review_field_received,
} satisfies Record<GiftDiffField, () => string>;

export interface LabelledDiff {
	label: string;
	before: string | null;
	after: string | null;
}

export interface CardPair {
	before: GiftByRole | null;
	after: GiftByRole | null;
	/** The before card is a gift the row deletes. */
	removal: boolean;
}

export interface GiftChangeModel {
	giftId: string;
	name: string;
	diffs: LabelledDiff[];
	appends: DescriptionAppend[];
	originalDescription: string | null;
	context: string | null;
	cards: CardPair | null;
}

export interface RowIdentity {
	name: string;
	sub: string | null;
	imageUrl: string | null;
	imageMeta: ImageMetadata | null;
	/** No gift to picture: a wishlist-level row, an invitation or a gift that is gone. */
	iconOnly: boolean;
}

export interface RowConsequence {
	text: string;
	/** An invitation's exact address, shown in full before the sentence. */
	email: string | null;
}

export interface ChangeRowModel {
	identity: RowIdentity;
	giftChanges: GiftChangeModel[];
	moreCount: number;
	consequence: RowConsequence | null;
	reasons: string[];
	currentCards: CardPair | null;
	confirmTitle: string;
	confirmDetail: RowConsequence;
	giftIds: string[];
}

export interface ChangeRowContext {
	currentGifts: readonly GiftByRole[];
	categories: readonly PublicGiftCategory[];
	priorityLevels: readonly { id: string; label: string }[];
	submitterName: string;
	kindTitle: (kind: ChangeKind) => string;
}

function inputField(input: unknown, key: string): unknown {
	return typeof input === 'object' && input !== null
		? (input as Record<string, unknown>)[key]
		: undefined;
}

function inputText(input: unknown, key: string): string | null {
	const value = inputField(input, key);
	return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function inputStrings(input: unknown, key: string): string[] {
	const value = inputField(input, key);
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function categoryById(context: ChangeRowContext, categoryId: string): PublicGiftCategory | null {
	return (
		context.categories.find((category) => category.id === categoryId) ??
		context.currentGifts.find((gift) => gift.category?.id === categoryId)?.category ??
		null
	);
}

export function giftLabelLookups(
	context: ChangeRowContext,
	categoryLabel: (category: PublicGiftCategory) => string,
): GiftLabelLookups {
	return {
		categoryLabel: (categoryId) => {
			const category = categoryById(context, categoryId);
			return category === null ? null : categoryLabel(category);
		},
		priorityLabel: (priorityLevelId) =>
			context.priorityLevels.find((level) => level.id === priorityLevelId)?.label ??
			context.currentGifts.find((gift) => gift.priorityLevelId === priorityLevelId)
				?.priorityLabel ??
			null,
	};
}

/** A snapshot shaped as a recipient-view gift, so the real GiftCard renders it without reservation data. */
function previewGift(
	snapshot: ChangeProposalGift,
	giftId: string,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): GiftForRecipient {
	return {
		id: giftId,
		wishlistId: '',
		name: snapshot.name,
		description: snapshot.description,
		descriptionAppends: snapshot.descriptionAppends,
		editedAfterShareAt:
			snapshot.editedAfterShareAt === null ? null : new Date(snapshot.editedAfterShareAt),
		links: snapshot.links,
		price: snapshot.price,
		priceMax: snapshot.priceMax,
		currency: snapshot.currency,
		imageUrl: snapshot.imageUrl,
		imageKey: null,
		imageMeta: snapshot.imageMeta,
		quantity: snapshot.quantity,
		sortOrder: 0,
		received: snapshot.received,
		createdAt: new Date(0),
		priorityLevelId: snapshot.priorityLevelId,
		priorityLabel:
			snapshot.priorityLevelId === null
				? null
				: lookups.priorityLabel(snapshot.priorityLevelId),
		prioritySortOrder: null,
		categoryId: snapshot.categoryId,
		category: snapshot.categoryId === null ? null : categoryById(context, snapshot.categoryId),
	};
}

function giftPositionSub(context: ChangeRowContext, giftId: string): string | null {
	const index = context.currentGifts.findIndex((gift) => gift.id === giftId);
	if (index === -1) {
		return null;
	}
	const domain = extractGiftUrlDomain(context.currentGifts[index]!.links[0]?.url ?? null);
	const position = m.change_review_position_sub({ position: index + 1 });
	return domain === null ? position : `${position} · ${domain}`;
}

function labelled(diffs: ReturnType<typeof giftFieldDiffs>): LabelledDiff[] {
	return diffs.map((diff) => ({
		label: FIELD_LABELS[diff.field](),
		before: diff.before,
		after: diff.after,
	}));
}

function previewChange(
	change: NonNullable<ChangeProposalRowView['preview']>['gifts'][number],
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): GiftChangeModel {
	const { before, after, giftId } = change;
	const diffs = giftFieldDiffs(before, after, lookups);
	const appends = appendedDescriptions(before, after);
	const removal = isGiftDeletion(before, after);
	return {
		giftId,
		name: removal && before !== null ? before.name : after.name,
		diffs: labelled(diffs),
		appends,
		originalDescription: appends.length > 0 ? (before?.description ?? null) : null,
		context: null,
		cards: showsGiftCards(before, after, diffs)
			? {
					before: before === null ? null : previewGift(before, giftId, context, lookups),
					after: removal ? null : previewGift(after, giftId, context, lookups),
					removal,
				}
			: null,
	};
}

function reorderChanges(row: ChangeProposalRowView, context: ChangeRowContext): GiftChangeModel[] {
	return reorderMoves(inputStrings(row.input, 'orderedGiftIds'), context.currentGifts).map(
		(move) => ({
			giftId: move.giftId,
			name: move.name,
			diffs: [
				{
					label: m.change_review_field_position(),
					before: String(move.fromPosition),
					after: String(move.toPosition),
				},
			],
			appends: [],
			originalDescription: null,
			context:
				move.previousName !== null && move.nextName !== null
					? m.change_review_reorder_between({
							previous: move.previousName,
							next: move.nextName,
						})
					: move.nextName !== null
						? m.change_review_reorder_first({ next: move.nextName })
						: move.previousName !== null
							? m.change_review_reorder_last({ previous: move.previousName })
							: null,
			cards: null,
		}),
	);
}

function targetGiftId(row: ChangeProposalRowView): string | null {
	return inputText(row.input, 'giftId') ?? inputText(row.input, 'id');
}

const WISHLIST_LEVEL_KINDS = new Set<ChangeKind>([
	CHANGE_KIND.category,
	CHANGE_KIND.priorityLevel,
	CHANGE_KIND.wishlistDetails,
	CHANGE_KIND.wishlistCreation,
	CHANGE_KIND.managerInvitation,
	CHANGE_KIND.undo,
]);

function iconIdentity(name: string, sub: string | null = null): RowIdentity {
	return { name, sub, imageUrl: null, imageMeta: null, iconOnly: true };
}

/** The gift as the dry run saw it: before a deletion, after any other change. */
function previewIdentity(
	row: ChangeProposalRowView,
	firstChange: GiftChangeModel | undefined,
	context: ChangeRowContext,
): RowIdentity | null {
	const firstPreview = row.preview?.gifts[0];
	if (firstPreview === undefined) {
		return null;
	}
	const snapshot = firstPreview.after.deleted ? firstPreview.before : firstPreview.after;
	if (snapshot === null) {
		return null;
	}
	return {
		name: firstChange?.name ?? snapshot.name,
		sub:
			firstPreview.before === null
				? m.change_review_new_gift_sub()
				: giftPositionSub(context, firstPreview.giftId),
		imageUrl: snapshot.imageUrl,
		imageMeta: snapshot.imageMeta,
		iconOnly: false,
	};
}

function currentGiftIdentity(giftId: string | null, context: ChangeRowContext): RowIdentity | null {
	const currentGift = context.currentGifts.find((gift) => gift.id === giftId);
	if (currentGift === undefined) {
		return null;
	}
	return {
		name: currentGift.name,
		sub: giftPositionSub(context, currentGift.id),
		imageUrl: currentGift.imageUrl,
		imageMeta: currentGift.imageMeta,
		iconOnly: false,
	};
}

function fallbackName(
	row: ChangeProposalRowView,
	giftId: string | null,
	context: ChangeRowContext,
): string {
	if (WISHLIST_LEVEL_KINDS.has(row.kind)) {
		return (
			inputText(row.input, 'label') ??
			inputText(row.input, 'title') ??
			m.change_review_wishlist_change_name()
		);
	}
	return giftId === null ? context.kindTitle(row.kind) : m.change_review_unknown_gift();
}

function rowIdentity(
	row: ChangeProposalRowView,
	firstChange: GiftChangeModel | undefined,
	context: ChangeRowContext,
): RowIdentity {
	if (row.kind === CHANGE_KIND.managerInvitation) {
		return iconIdentity(m.change_review_invitation_name(), m.change_review_invitation_sub());
	}
	const giftId = firstChange?.giftId ?? targetGiftId(row);
	return (
		previewIdentity(row, firstChange, context) ??
		currentGiftIdentity(giftId, context) ??
		iconIdentity(fallbackName(row, giftId, context))
	);
}

function reservedQuantity(row: ChangeProposalRowView): number {
	const quantity = inputField(row.input, 'quantity');
	return typeof quantity === 'number' ? quantity : 1;
}

function rowConsequence(
	row: ChangeProposalRowView,
	identity: RowIdentity,
	context: ChangeRowContext,
): RowConsequence | null {
	if (row.kind === CHANGE_KIND.giftDeletion) {
		return { text: m.change_review_deletion_consequence({ name: identity.name }), email: null };
	}
	if (row.kind === CHANGE_KIND.managerInvitation) {
		return {
			text: m.change_review_invitation_consequence(),
			email: inputText(row.input, 'email'),
		};
	}
	switch (row.operation) {
		case RESERVATION_OPERATION.reserve:
			return {
				text: m.change_review_reservation_consequence({
					count: reservedQuantity(row),
					name: context.submitterName,
				}),
				email: null,
			};
		case RESERVATION_OPERATION.cancel:
			return { text: m.change_review_cancel_reservation_consequence(), email: null };
		case RESERVATION_OPERATION.markPurchased:
			return { text: m.change_review_purchased_consequence(), email: null };
		default:
			return null;
	}
}

function conflictReason(conflict: ChangeRowConflict): string {
	if (conflict.current === null) {
		return m.change_review_conflict_gone();
	}
	if (conflict.changedByName === null || conflict.changedAt === null) {
		return m.change_review_conflict_reason_anonymous();
	}
	return m.change_review_conflict_reason({
		name: conflict.changedByName,
		date: formatChangeReviewDateTime(conflict.changedAt),
	});
}

function rowReasons(row: ChangeProposalRowView): string[] {
	if (row.error !== null) {
		return [
			translateServerErrorCode(
				row.error.code,
				row.error.details,
				m.change_review_rejected_fallback(),
			),
		];
	}
	return row.conflicts.map(conflictReason);
}

function currentCards(
	row: ChangeProposalRowView,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): CardPair | null {
	const conflict = row.conflicts[0];
	const proposed = row.preview?.gifts.find((change) => change.giftId === conflict?.giftId);
	if (conflict?.current == null || proposed === undefined) {
		return null;
	}
	return {
		before: previewGift(conflict.current, conflict.giftId, context, lookups),
		after: previewGift(proposed.after, proposed.giftId, context, lookups),
		removal: false,
	};
}

function confirmTitle(
	row: ChangeProposalRowView,
	identity: RowIdentity,
	context: ChangeRowContext,
): string {
	if (row.kind === CHANGE_KIND.giftDeletion) {
		return m.change_review_confirm_deletion({ name: identity.name });
	}
	if (row.operation === RESERVATION_OPERATION.reserve) {
		return m.change_review_confirm_reservation({
			count: reservedQuantity(row),
			name: identity.name,
		});
	}
	return `${context.kindTitle(row.kind)}: ${identity.name}`;
}

function confirmDetail(
	row: ChangeProposalRowView,
	consequence: RowConsequence | null,
	context: ChangeRowContext,
): RowConsequence {
	if (row.kind === CHANGE_KIND.giftDeletion) {
		return { text: m.change_review_confirm_deletion_detail(), email: null };
	}
	if (row.operation === RESERVATION_OPERATION.reserve) {
		return {
			text: m.change_review_confirm_reservation_detail({ name: context.submitterName }),
			email: null,
		};
	}
	return consequence ?? { text: context.kindTitle(row.kind), email: null };
}

/** Everything one review row shows, resolved from the row view and the wishlist's current gifts. */
export function buildChangeRowModel(
	row: ChangeProposalRowView,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): ChangeRowModel {
	const allChanges =
		row.kind === CHANGE_KIND.reorder
			? reorderChanges(row, context)
			: (row.preview?.gifts ?? []).map((change) => previewChange(change, context, lookups));
	const visibleCount =
		row.kind === CHANGE_KIND.reorder ? REORDER_VISIBLE_MOVES : allChanges.length;
	const giftChanges = allChanges.slice(0, visibleCount);
	const identity = rowIdentity(row, giftChanges[0], context);
	const consequence = rowConsequence(row, identity, context);
	const previewGiftIds = (row.preview?.gifts ?? []).map((change) => change.giftId);
	const target = targetGiftId(row);
	return {
		identity,
		giftChanges,
		moreCount: allChanges.length - giftChanges.length,
		// A row that never applies has no consequence to warn about, only its reasons.
		consequence: changeRowGroup(row) === CHANGE_ROW_GROUP.blocked ? null : consequence,
		reasons: rowReasons(row),
		currentCards: currentCards(row, context, lookups),
		confirmTitle: confirmTitle(row, identity, context),
		confirmDetail: confirmDetail(row, consequence, context),
		giftIds:
			target === null || previewGiftIds.includes(target)
				? previewGiftIds
				: [...previewGiftIds, target],
	};
}
