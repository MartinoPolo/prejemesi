import * as m from '$lib/paraglide/messages.js';
import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
import type { DescriptionAppend, GiftByRole, GiftForRecipient } from '$lib/modules/gifts/types.js';
import type { ImageMetadata } from '$lib/modules/images/types.js';
import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import { giftCategoryIdsFromLegacyCategoryId } from '$lib/modules/gift-categories/gift_category_assignment.js';
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
	type GiftFieldDiff,
	type GiftLabelLookups,
} from '$lib/modules/change_proposals/change_review_diffs.js';
import { formatChangeReviewDateTime } from '$lib/modules/change_proposals/change_review_copy.js';
import {
	CHANGE_DECISION,
	CHANGE_FIELD,
	CHANGE_FIELDS,
	changeInputRecord,
	isEditableChangeField,
	isRequiredChangeField,
	type ChangeField,
} from '$lib/modules/change_proposals/change_field_decisions.js';
import {
	CHANGE_ROW_GROUP,
	FIELD_REVIEW_STATE,
	ROW_REVIEW_KIND,
	SNAPSHOT_KEYS_BY_FIELD,
	changeRowGroup,
	fieldEditorText,
	fieldReviewState,
	isGiftDropped,
	isRowIncluded,
	sameSnapshotValue,
	type FieldReview,
	type FieldReviewState,
	type RowReview,
} from '$lib/modules/change_proposals/change_review_decisions.js';

/** Reservation operations the page words differently; the server's operation policies own the full list. */
export const RESERVATION_OPERATION = {
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
	/** The reviewer rejected every field of a new gift, so it will not be added. */
	dropped: boolean;
}

export const FIELD_EDITOR_CONTROL = {
	text: 'text',
	textarea: 'textarea',
	number: 'number',
	select: 'select',
} as const;

export type FieldEditorControl = (typeof FIELD_EDITOR_CONTROL)[keyof typeof FIELD_EDITOR_CONTROL];

export interface FieldEditor {
	control: FieldEditorControl;
	/** The value the editor opens with: the reviewer's own, else the agent's. */
	text: string;
	/** Choices of a select; the empty value clears the field. */
	options: { value: string; label: string }[];
}

/** One field a reviewer accepts, rejects or edits, with the value that would apply. */
export interface FieldChangeModel {
	field: ChangeField;
	label: string;
	diffs: LabelledDiff[];
	appends: string[];
	/** The agent's value, shown once the reviewer replaced it with their own. */
	proposed: string | null;
	state: FieldReviewState;
	/** A new gift's name: only the whole gift can be rejected. */
	required: boolean;
	editor: FieldEditor | null;
}

export const GIFT_LIVE_PREVIEW = {
	edit: 'edit',
	creation: 'creation',
	deletion: 'deletion',
} as const;

export type GiftLivePreviewKind = (typeof GIFT_LIVE_PREVIEW)[keyof typeof GIFT_LIVE_PREVIEW];

/** How the wishlist shows a gift while its proposal is decided: the edit, the new gift or the deletion. */
export type GiftLivePreview =
	| { kind: typeof GIFT_LIVE_PREVIEW.edit; giftId: string; changes: Partial<GiftForRecipient> }
	| { kind: typeof GIFT_LIVE_PREVIEW.creation; giftId: string; gift: GiftForRecipient }
	| { kind: typeof GIFT_LIVE_PREVIEW.deletion; giftId: string };

export interface GiftChangeModel {
	giftId: string;
	name: string;
	/** Reviewed fields; empty when the row is decided whole or no longer reviewed. */
	fields: FieldChangeModel[];
	/** Changes outside the reviewed fields, such as defaults a new gift gets. */
	diffs: LabelledDiff[];
	appends: DescriptionAppend[];
	originalDescription: string | null;
	context: string | null;
	cards: CardPair | null;
	livePreview: GiftLivePreview | null;
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
		context.currentGifts
			.flatMap((gift) => gift.categories)
			.find((category) => category.id === categoryId) ??
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
		categoryIds: snapshot.categoryIds,
		categories: snapshot.categoryIds.flatMap((categoryId) => {
			const category = categoryById(context, categoryId);
			return category === null ? [] : [category];
		}),
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

function labelled(diffs: readonly GiftFieldDiff[]): LabelledDiff[] {
	return diffs.map((diff) => ({
		label: FIELD_LABELS[diff.field](),
		before: diff.before,
		after: diff.after,
	}));
}

const CHANGE_FIELD_LABELS = {
	name: m.change_review_field_name,
	description: m.change_review_field_description,
	append: m.change_review_field_description,
	price: m.change_review_field_price,
	quantity: m.change_review_field_quantity,
	category: m.change_review_field_category,
	priority: m.change_review_field_priority,
	links: m.change_review_field_link,
	image: m.change_review_field_image,
} satisfies Record<ChangeField, () => string>;

/** The reviewed field a displayed diff belongs to; the rest are not the reviewer's to decide. */
const CHANGE_FIELD_BY_DIFF_FIELD = {
	gift: null,
	name: CHANGE_FIELD.name,
	description: CHANGE_FIELD.description,
	price: CHANGE_FIELD.price,
	quantity: CHANGE_FIELD.quantity,
	category: CHANGE_FIELD.category,
	priority: CHANGE_FIELD.priority,
	image: CHANGE_FIELD.image,
	link: CHANGE_FIELD.links,
	received: null,
} satisfies Record<GiftDiffField, ChangeField | null>;

type PreviewChange = NonNullable<ChangeProposalRowView['preview']>['gifts'][number];
type FieldsReview = Extract<RowReview, { kind: typeof ROW_REVIEW_KIND.fields }>;

/** What a new gift is without a field: the server leaves it empty. */
function emptiedGift(gift: ChangeProposalGift): ChangeProposalGift {
	return {
		...gift,
		description: null,
		descriptionAppends: [],
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageMeta: null,
		quantity: null,
		priorityLevelId: null,
		categoryIds: [],
	};
}

function copySnapshotKey<Key extends keyof ChangeProposalGift>(
	target: ChangeProposalGift,
	source: ChangeProposalGift,
	key: Key,
) {
	target[key] = source[key];
}

function nullableText(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
	return typeof value === 'number' ? value : null;
}

/** The gift with the reviewer's own value for one field. */
function withEditedField(
	gift: ChangeProposalGift,
	field: ChangeField,
	edited: Readonly<Record<string, unknown>>,
): ChangeProposalGift {
	switch (field) {
		case CHANGE_FIELD.name:
			return { ...gift, name: nullableText(edited.name) ?? gift.name };
		case CHANGE_FIELD.description:
			return { ...gift, description: nullableText(edited.description) };
		case CHANGE_FIELD.append: {
			const appends = [...gift.descriptionAppends];
			const last = appends.pop();
			const text = nullableText(edited.text);
			return last === undefined || text === null
				? gift
				: { ...gift, descriptionAppends: [...appends, { ...last, text }] };
		}
		case CHANGE_FIELD.price:
			return {
				...gift,
				price: nullableNumber(edited.price),
				priceMax: nullableNumber(edited.priceMax),
				currency: nullableText(edited.currency) ?? gift.currency,
			};
		case CHANGE_FIELD.quantity:
			return { ...gift, quantity: nullableNumber(edited.quantity) };
		case CHANGE_FIELD.category:
			return {
				...gift,
				categoryIds: Array.isArray(edited.categoryIds)
					? edited.categoryIds.filter((id): id is string => typeof id === 'string')
					: giftCategoryIdsFromLegacyCategoryId(
							gift.categoryIds,
							nullableText(edited.categoryId),
						),
			};
		case CHANGE_FIELD.priority:
			return { ...gift, priorityLevelId: nullableText(edited.priorityLevelId) };
		case CHANGE_FIELD.links:
		case CHANGE_FIELD.image:
			return gift;
	}
}

/** The gift applying would produce: rejected and unresolved fields keep the current value. */
function effectiveGift(change: PreviewChange, review: FieldsReview): ChangeProposalGift {
	const base = change.before ?? emptiedGift(change.after);
	let gift: ChangeProposalGift = { ...change.after };
	for (const field of CHANGE_FIELDS) {
		const fieldReview = review.fields[field];
		if (fieldReview === undefined) {
			continue;
		}
		if (fieldReview.decision !== CHANGE_DECISION.accepted) {
			for (const key of SNAPSHOT_KEYS_BY_FIELD[field]) {
				copySnapshotKey(gift, base, key);
			}
		} else if (fieldReview.edited !== null) {
			gift = withEditedField(gift, field, fieldReview.edited);
		}
	}
	return gift;
}

function fieldDiffs(diffs: readonly GiftFieldDiff[], field: ChangeField): GiftFieldDiff[] {
	return diffs.filter((diff) => CHANGE_FIELD_BY_DIFF_FIELD[diff.field] === field);
}

function selectOptions(
	field: ChangeField,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): FieldEditor['options'] {
	if (field === CHANGE_FIELD.category) {
		return [
			{ value: '', label: m.change_review_edit_no_category() },
			...context.categories.map((category) => ({
				value: category.id,
				label: lookups.categoryLabel(category.id) ?? category.id,
			})),
		];
	}
	return [
		{ value: '', label: m.change_review_edit_no_priority() },
		...context.priorityLevels.map((level) => ({ value: level.id, label: level.label })),
	];
}

const EDITOR_CONTROLS = {
	name: FIELD_EDITOR_CONTROL.text,
	description: FIELD_EDITOR_CONTROL.textarea,
	append: FIELD_EDITOR_CONTROL.textarea,
	price: FIELD_EDITOR_CONTROL.text,
	quantity: FIELD_EDITOR_CONTROL.number,
	category: FIELD_EDITOR_CONTROL.select,
	priority: FIELD_EDITOR_CONTROL.select,
	links: null,
	image: null,
} satisfies Record<ChangeField, FieldEditorControl | null>;

/** A description the gift shows as an append (it is shared) is only accepted or rejected. */
function fieldEditor(
	row: ChangeProposalRowView,
	field: ChangeField,
	fieldReview: FieldReview,
	describedAsAppend: boolean,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): FieldEditor | null {
	const control = EDITOR_CONTROLS[field];
	const input = changeInputRecord(row.input);
	if (
		control === null ||
		!isEditableChangeField(field) ||
		(field === CHANGE_FIELD.description &&
			(describedAsAppend || input === null || !Object.hasOwn(input, 'description')))
	) {
		return null;
	}
	return {
		control,
		text: fieldEditorText(field, fieldReview.edited ?? row.input),
		options:
			control === FIELD_EDITOR_CONTROL.select ? selectOptions(field, context, lookups) : [],
	};
}

interface ReviewedFields {
	fields: FieldChangeModel[];
	otherDiffs: GiftFieldDiff[];
	otherAppends: DescriptionAppend[];
}

function reviewedFields(
	row: ChangeProposalRowView,
	change: PreviewChange,
	review: FieldsReview,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): ReviewedFields {
	const { before, after } = change;
	const proposedDiffs = giftFieldDiffs(before, after, lookups);
	const proposedAppends = appendedDescriptions(before, after);
	const reviewed = CHANGE_FIELDS.filter((field) => review.fields[field] !== undefined);
	const appendField = reviewed.includes(CHANGE_FIELD.append)
		? CHANGE_FIELD.append
		: reviewed.includes(CHANGE_FIELD.description) && proposedAppends.length > 0
			? CHANGE_FIELD.description
			: null;
	const fields = reviewed.flatMap((field) => {
		const fieldReview = review.fields[field];
		if (fieldReview === undefined) {
			return [];
		}
		const state = fieldReviewState(fieldReview);
		const proposed = fieldDiffs(proposedDiffs, field);
		const appends = field === appendField ? proposedAppends.map((append) => append.text) : [];
		const edited =
			state === FIELD_REVIEW_STATE.edited && fieldReview.edited !== null
				? withEditedField(after, field, fieldReview.edited)
				: null;
		return [
			{
				field,
				label: CHANGE_FIELD_LABELS[field](),
				diffs: labelled(
					edited === null
						? proposed
						: fieldDiffs(giftFieldDiffs(before, edited, lookups), field),
				),
				appends:
					edited === null || field !== appendField
						? appends
						: appendedDescriptions(before, edited).map((append) => append.text),
				proposed: edited === null ? null : (proposed[0]?.after ?? appends[0] ?? null),
				state,
				required: isRequiredChangeField(row.operation, field),
				editor: fieldEditor(
					row,
					field,
					fieldReview,
					field === appendField,
					context,
					lookups,
				),
			},
		];
	});
	return {
		fields,
		otherDiffs: proposedDiffs.filter((diff) => {
			const field = CHANGE_FIELD_BY_DIFF_FIELD[diff.field];
			return field === null || !reviewed.includes(field);
		}),
		otherAppends: appendField === null ? proposedAppends : [],
	};
}

/** The card keys a live preview takes from the decided gift once a snapshot key changes. */
const LIVE_PREVIEW_CARD_KEYS: readonly (readonly [
	keyof ChangeProposalGift,
	readonly (keyof GiftForRecipient)[],
])[] = [
	['name', ['name']],
	['description', ['description']],
	['descriptionAppends', ['descriptionAppends']],
	['links', ['links']],
	['price', ['price']],
	['priceMax', ['priceMax']],
	['currency', ['currency']],
	['imageUrl', ['imageUrl', 'imageKey']],
	['imageMeta', ['imageMeta']],
	['quantity', ['quantity']],
	['priorityLevelId', ['priorityLevelId', 'priorityLabel']],
	['categoryIds', ['categoryIds', 'categories']],
];

function copyCardKey<Key extends keyof GiftForRecipient>(
	target: Partial<GiftForRecipient>,
	source: GiftForRecipient,
	key: Key,
) {
	target[key] = source[key];
}

/**
 * A deletion shows until the user keeps the gift; an edit or a new gift shows while it keeps an
 * accepted field, with the reviewer's decisions and edits applied.
 */
function livePreview(
	change: PreviewChange,
	rowReview: RowReview | undefined,
	shownAfter: ChangeProposalGift,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): GiftLivePreview | null {
	const { before, after, giftId } = change;
	if (isGiftDeletion(before, after)) {
		const kept = rowReview?.kind === ROW_REVIEW_KIND.whole && rowReview.accepted === false;
		return kept ? null : { kind: GIFT_LIVE_PREVIEW.deletion, giftId };
	}
	if (!isRowIncluded(rowReview)) {
		return null;
	}
	const card = previewGift(shownAfter, giftId, context, lookups);
	if (before === null) {
		return { kind: GIFT_LIVE_PREVIEW.creation, giftId, gift: card };
	}
	const changes: Partial<GiftForRecipient> = {};
	for (const [snapshotKey, cardKeys] of LIVE_PREVIEW_CARD_KEYS) {
		if (!sameSnapshotValue(before[snapshotKey], shownAfter[snapshotKey])) {
			for (const cardKey of cardKeys) {
				copyCardKey(changes, card, cardKey);
			}
		}
	}
	return Object.keys(changes).length === 0
		? null
		: { kind: GIFT_LIVE_PREVIEW.edit, giftId, changes };
}

function previewChange(
	row: ChangeProposalRowView,
	change: PreviewChange,
	rowReview: RowReview | undefined,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): GiftChangeModel {
	const { before, after, giftId } = change;
	const diffs = giftFieldDiffs(before, after, lookups);
	const removal = isGiftDeletion(before, after);
	const review = rowReview?.kind === ROW_REVIEW_KIND.fields ? rowReview : null;
	const reviewed =
		review === null
			? { fields: [], otherDiffs: diffs, otherAppends: appendedDescriptions(before, after) }
			: reviewedFields(row, change, review, context, lookups);
	const dropped = isGiftDropped(rowReview);
	const shownAfter = review === null ? after : effectiveGift(change, review);
	const hasAppends =
		reviewed.otherAppends.length > 0 ||
		reviewed.fields.some((field) => field.appends.length > 0);
	return {
		giftId,
		name: removal && before !== null ? before.name : after.name,
		fields: reviewed.fields,
		diffs: labelled(reviewed.otherDiffs),
		appends: reviewed.otherAppends,
		originalDescription: hasAppends ? (before?.description ?? null) : null,
		context: null,
		cards: showsGiftCards(before, after, diffs)
			? previewCards(change, shownAfter, dropped, context, lookups)
			: null,
		livePreview: livePreview(change, rowReview, shownAfter, context, lookups),
	};
}

function previewCards(
	change: PreviewChange,
	shownAfter: ChangeProposalGift,
	dropped: boolean,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
): CardPair {
	const { before, after, giftId } = change;
	const removal = isGiftDeletion(before, after);
	return {
		before: before === null ? null : previewGift(before, giftId, context, lookups),
		after: removal || dropped ? null : previewGift(shownAfter, giftId, context, lookups),
		removal,
		dropped,
	};
}

function reorderChanges(row: ChangeProposalRowView, context: ChangeRowContext): GiftChangeModel[] {
	return reorderMoves(inputStrings(row.input, 'orderedGiftIds'), context.currentGifts).map(
		(move) => ({
			giftId: move.giftId,
			name: move.name,
			fields: [],
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
			livePreview: null,
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
		dropped: false,
	};
}

/** Everything one review row shows, resolved from the row view and the wishlist's current gifts. */
export function buildChangeRowModel(
	row: ChangeProposalRowView,
	context: ChangeRowContext,
	lookups: GiftLabelLookups,
	rowReview?: RowReview,
): ChangeRowModel {
	const allChanges =
		row.kind === CHANGE_KIND.reorder
			? reorderChanges(row, context)
			: (row.preview?.gifts ?? []).map((change) =>
					previewChange(row, change, rowReview, context, lookups),
				);
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
		giftIds:
			target === null || previewGiftIds.includes(target)
				? previewGiftIds
				: [...previewGiftIds, target],
	};
}
