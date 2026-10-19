import {
	CHANGE_DECISION,
	CHANGE_FIELDS,
	FIELD_DECISION,
	changeInputRecord,
	changeRowFields,
	isFieldDecidedOperation,
	isRequiredChangeField,
	type ChangeDecision,
	type ChangeField,
	type ChangeRowDecision,
	type FieldDecision,
	type FieldDecisions,
} from './change_field_decisions.js';
import {
	CHANGE_KIND,
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalGift,
	type ChangeProposalRowView,
	type ChangeProposalState,
} from './types.js';

type ReviewRow = Pick<
	ChangeProposalRowView,
	| 'rowId'
	| 'kind'
	| 'operation'
	| 'input'
	| 'status'
	| 'requiresConfirmation'
	| 'error'
	| 'preview'
	| 'appliedFields'
>;

/** Where a row sits on the review page: confirmation rows first, rows that never apply last. */
export const CHANGE_ROW_GROUP = {
	confirm: 'confirm',
	ordinary: 'ordinary',
	blocked: 'blocked',
} as const;

export type ChangeRowGroup = (typeof CHANGE_ROW_GROUP)[keyof typeof CHANGE_ROW_GROUP];

export function changeRowGroup(row: Pick<ReviewRow, 'status' | 'requiresConfirmation' | 'error'>) {
	if (
		row.error !== null ||
		row.status === CHANGE_ROW_STATUS.conflict ||
		row.status === CHANGE_ROW_STATUS.rejected
	) {
		return CHANGE_ROW_GROUP.blocked;
	}
	return row.requiresConfirmation ? CHANGE_ROW_GROUP.confirm : CHANGE_ROW_GROUP.ordinary;
}

/** Only ready and confirmation rows take a decision; conflicts and rejected rows never apply. */
export function isDecidableChangeRow(row: Pick<ReviewRow, 'status' | 'error'>): boolean {
	return (
		row.error === null &&
		(row.status === CHANGE_ROW_STATUS.ready ||
			row.status === CHANGE_ROW_STATUS.needsConfirmation)
	);
}

/** A field's review: unresolved (null), accepted with the reviewer's own input or not, or rejected. */
export interface FieldReview {
	decision: ChangeDecision | null;
	edited: Readonly<Record<string, unknown>> | null;
}

export const ROW_REVIEW_KIND = {
	whole: 'whole',
	fields: 'fields',
} as const;

export type RowReview =
	| { kind: typeof ROW_REVIEW_KIND.whole; accepted: boolean | null }
	| {
			kind: typeof ROW_REVIEW_KIND.fields;
			/** The field a new gift cannot lose on its own, if any. */
			required: ChangeField | null;
			fields: Readonly<Partial<Record<ChangeField, FieldReview>>>;
	  };

/** The reviewer's decisions by row id; rows that never apply have none. */
export type ChangeReview = Readonly<Record<string, RowReview>>;

/** The gift snapshot keys each field changes, to tell which proposed fields change anything. */
export const SNAPSHOT_KEYS_BY_FIELD = {
	name: ['name'],
	description: ['description', 'descriptionAppends'],
	append: ['descriptionAppends'],
	price: ['price', 'priceMax', 'currency'],
	quantity: ['quantity'],
	category: ['categoryId'],
	priority: ['priorityLevelId'],
	links: ['links'],
	image: ['imageUrl', 'imageMeta'],
} as const satisfies Record<ChangeField, readonly (keyof ChangeProposalGift)[]>;

function sameSnapshotValue(first: unknown, second: unknown): boolean {
	return JSON.stringify(first) === JSON.stringify(second);
}

/**
 * The fields a row is reviewed by, in review order: those its input sets that change the gift.
 * A field the input repeats unchanged has nothing to decide and applies as proposed.
 */
export function reviewedChangeFields(
	row: Pick<ReviewRow, 'operation' | 'input' | 'preview'>,
): ChangeField[] {
	const fields = changeRowFields(row.operation, row.input);
	const change = row.preview?.gifts[0];
	if (change === undefined || change.before === null) {
		return fields;
	}
	const { before, after } = change;
	return fields.filter((field) =>
		SNAPSHOT_KEYS_BY_FIELD[field].some((key) => !sameSnapshotValue(before[key], after[key])),
	);
}

function requiredField(row: Pick<ReviewRow, 'operation'>, fields: readonly ChangeField[]) {
	return fields.find((field) => isRequiredChangeField(row.operation, field)) ?? null;
}

function rowReviewOf(row: ReviewRow, accepted: boolean | null): RowReview {
	const fields = row.requiresConfirmation ? [] : reviewedChangeFields(row);
	if (!isFieldDecidedOperation(row.operation) || fields.length === 0) {
		return { kind: ROW_REVIEW_KIND.whole, accepted };
	}
	const decision =
		accepted === null ? null : accepted ? CHANGE_DECISION.accepted : CHANGE_DECISION.rejected;
	return {
		kind: ROW_REVIEW_KIND.fields,
		required: requiredField(row, fields),
		fields: Object.fromEntries(fields.map((field) => [field, { decision, edited: null }])),
	};
}

/** Edits and new gifts start accepted; deletions, reservations and invitations wait for the reviewer. */
export function initialChangeReview(rows: readonly ReviewRow[]): ChangeReview {
	return Object.fromEntries(
		rows
			.filter(isDecidableChangeRow)
			.map((row) => [row.rowId, rowReviewOf(row, row.requiresConfirmation ? null : true)]),
	);
}

/** What an applied proposal applied, so the closed page shows each field as it was decided. */
export function appliedChangeReview(rows: readonly ReviewRow[]): ChangeReview {
	return Object.fromEntries(
		rows
			.filter((row) => row.status === CHANGE_ROW_STATUS.applied)
			.map((row) => {
				const review = rowReviewOf(row, true);
				if (review.kind === ROW_REVIEW_KIND.whole) {
					return [row.rowId, review];
				}
				const applied = row.appliedFields ?? {};
				const fields = Object.fromEntries(
					fieldEntries(review).map(([field]) => {
						const decision = applied[field];
						return [
							field,
							decision === undefined
								? { decision: CHANGE_DECISION.accepted, edited: null }
								: decision.decision === FIELD_DECISION.rejected
									? { decision: CHANGE_DECISION.rejected, edited: null }
									: {
											decision: CHANGE_DECISION.accepted,
											edited: decision.input,
										},
						];
					}),
				);
				return [row.rowId, { ...review, fields }];
			}),
	);
}

function fieldEntries(
	review: Extract<RowReview, { kind: 'fields' }>,
): [ChangeField, FieldReview][] {
	return CHANGE_FIELDS.flatMap((field) => {
		const fieldReview = review.fields[field];
		return fieldReview === undefined ? [] : [[field, fieldReview]];
	});
}

function optionalFieldReviews(review: Extract<RowReview, { kind: 'fields' }>): FieldReview[] {
	return fieldEntries(review)
		.filter(([field]) => field !== review.required)
		.map(([, fieldReview]) => fieldReview);
}

/** A new gift goes when its name is rejected, which happens once every other field is rejected. */
export function isGiftDropped(review: RowReview | undefined): boolean {
	return (
		review?.kind === ROW_REVIEW_KIND.fields &&
		review.required !== null &&
		review.fields[review.required]?.decision === CHANGE_DECISION.rejected
	);
}

/** Keeps a new gift's name in step with its other fields: all rejected drops the gift, any kept keeps it. */
function withRequiredFieldInStep(review: RowReview): RowReview {
	if (review.kind !== ROW_REVIEW_KIND.fields || review.required === null) {
		return review;
	}
	const optional = optionalFieldReviews(review);
	const required = review.fields[review.required];
	if (optional.length === 0 || required === undefined) {
		return review;
	}
	const allRejected = optional.every((field) => field.decision === CHANGE_DECISION.rejected);
	if (allRejected && required.decision !== CHANGE_DECISION.rejected) {
		return {
			...review,
			fields: {
				...review.fields,
				[review.required]: { decision: CHANGE_DECISION.rejected, edited: null },
			},
		};
	}
	if (!allRejected && required.decision === CHANGE_DECISION.rejected) {
		return {
			...review,
			fields: {
				...review.fields,
				[review.required]: { decision: CHANGE_DECISION.accepted, edited: null },
			},
		};
	}
	return review;
}

function withRowReview(review: ChangeReview, rowId: string, rowReview: RowReview): ChangeReview {
	return { ...review, [rowId]: withRequiredFieldInStep(rowReview) };
}

/** Sets a whole gift or row: accepting keeps the reviewer's own values, rejecting drops them. */
function decidedRowReview(rowReview: RowReview, decision: ChangeDecision): RowReview {
	if (rowReview.kind === ROW_REVIEW_KIND.whole) {
		return { ...rowReview, accepted: decision === CHANGE_DECISION.accepted };
	}
	return {
		...rowReview,
		fields: Object.fromEntries(
			fieldEntries(rowReview).map(([field, fieldReview]) => [
				field,
				decision === CHANGE_DECISION.accepted &&
				fieldReview.decision === CHANGE_DECISION.accepted
					? fieldReview
					: { decision, edited: null },
			]),
		),
	};
}

export function withRowDecided(
	review: ChangeReview,
	rowId: string,
	decision: ChangeDecision,
): ChangeReview {
	const rowReview = review[rowId];
	return rowReview === undefined
		? review
		: withRowReview(review, rowId, decidedRowReview(rowReview, decision));
}

/** A whole-row choice; choosing the active one again clears it back to unresolved. */
export function withRowChoiceToggled(
	review: ChangeReview,
	rowId: string,
	accepted: boolean,
): ChangeReview {
	const rowReview = review[rowId];
	if (rowReview?.kind !== ROW_REVIEW_KIND.whole) {
		return review;
	}
	return withRowReview(review, rowId, {
		...rowReview,
		accepted: rowReview.accepted === accepted ? null : accepted,
	});
}

/** A field's ✓ or ✕; the active one clears the field back to unresolved. */
export function withFieldDecisionToggled(
	review: ChangeReview,
	rowId: string,
	field: ChangeField,
	decision: ChangeDecision,
): ChangeReview {
	const rowReview = review[rowId];
	const fieldReview =
		rowReview?.kind === ROW_REVIEW_KIND.fields ? rowReview.fields[field] : undefined;
	if (rowReview?.kind !== ROW_REVIEW_KIND.fields || fieldReview === undefined) {
		return review;
	}
	if (
		decision === CHANGE_DECISION.accepted &&
		field === rowReview.required &&
		isGiftDropped(rowReview)
	) {
		return withRowReview(review, rowId, decidedRowReview(rowReview, CHANGE_DECISION.accepted));
	}
	return withRowReview(review, rowId, {
		...rowReview,
		fields: {
			...rowReview.fields,
			[field]: {
				decision: fieldReview.decision === decision ? null : decision,
				edited: null,
			},
		},
	});
}

/** Saving the field editor accepts the field with the reviewer's value, or as proposed when unchanged. */
export function withFieldEdited(
	review: ChangeReview,
	rowId: string,
	field: ChangeField,
	edited: Readonly<Record<string, unknown>> | null,
): ChangeReview {
	const rowReview = review[rowId];
	if (rowReview?.kind !== ROW_REVIEW_KIND.fields || rowReview.fields[field] === undefined) {
		return review;
	}
	return withRowReview(review, rowId, {
		...rowReview,
		fields: { ...rowReview.fields, [field]: { decision: CHANGE_DECISION.accepted, edited } },
	});
}

/** Přijmout vše never resolves deletions, reservations or invitations; Zamítnout vše declines all. */
export function withEveryRowDecided(
	review: ChangeReview,
	rows: readonly Pick<ReviewRow, 'rowId' | 'requiresConfirmation'>[],
	decision: ChangeDecision,
): ChangeReview {
	return rows.reduce(
		(next, row) =>
			decision === CHANGE_DECISION.accepted && row.requiresConfirmation
				? next
				: withRowDecided(next, row.rowId, decision),
		review,
	);
}

export const FIELD_REVIEW_STATE = {
	accepted: 'accepted',
	edited: 'edited',
	rejected: 'rejected',
	undecided: 'undecided',
} as const;

export type FieldReviewState = (typeof FIELD_REVIEW_STATE)[keyof typeof FIELD_REVIEW_STATE];

export function fieldReviewState(fieldReview: FieldReview | undefined): FieldReviewState {
	if (fieldReview?.decision === CHANGE_DECISION.accepted) {
		return fieldReview.edited === null
			? FIELD_REVIEW_STATE.accepted
			: FIELD_REVIEW_STATE.edited;
	}
	return fieldReview?.decision === CHANGE_DECISION.rejected
		? FIELD_REVIEW_STATE.rejected
		: FIELD_REVIEW_STATE.undecided;
}

export function acceptedFieldCount(rowReview: RowReview | undefined): number {
	if (rowReview?.kind !== ROW_REVIEW_KIND.fields || isGiftDropped(rowReview)) {
		return 0;
	}
	return fieldEntries(rowReview).filter(
		([, field]) => field.decision === CHANGE_DECISION.accepted,
	).length;
}

export function rowUnresolvedCount(rowReview: RowReview | undefined): number {
	if (rowReview === undefined) {
		return 0;
	}
	if (rowReview.kind === ROW_REVIEW_KIND.whole) {
		return rowReview.accepted === null ? 1 : 0;
	}
	return fieldEntries(rowReview).filter(([, field]) => field.decision === null).length;
}

export function unresolvedChangeCount(review: ChangeReview): number {
	return Object.values(review).reduce((sum, rowReview) => sum + rowUnresolvedCount(rowReview), 0);
}

/** The row applies: a whole row accepted, or a gift that keeps at least one accepted field. */
export function isRowIncluded(rowReview: RowReview | undefined): boolean {
	if (rowReview === undefined) {
		return false;
	}
	return rowReview.kind === ROW_REVIEW_KIND.whole
		? rowReview.accepted === true
		: acceptedFieldCount(rowReview) > 0;
}

export function includedRowCount(review: ChangeReview): number {
	return Object.values(review).filter(isRowIncluded).length;
}

/** aria-pressed of a whole-gift button: true when every field has that decision, mixed when some do. */
export function wholeGiftPressed(
	rowReview: RowReview | undefined,
	decision: ChangeDecision,
): 'true' | 'mixed' | 'false' {
	if (rowReview?.kind !== ROW_REVIEW_KIND.fields) {
		return 'false';
	}
	const fields = fieldEntries(rowReview);
	const matching = fields.filter(([, field]) => field.decision === decision).length;
	if (matching === fields.length) {
		return 'true';
	}
	return matching > 0 ? 'mixed' : 'false';
}

function appliedFieldDecisions(rowReview: Extract<RowReview, { kind: 'fields' }>): FieldDecisions {
	return Object.fromEntries(
		fieldEntries(rowReview).flatMap(([field, fieldReview]): [ChangeField, FieldDecision][] => {
			if (fieldReview.decision === CHANGE_DECISION.rejected) {
				return [[field, { decision: FIELD_DECISION.rejected }]];
			}
			return fieldReview.edited === null
				? []
				: [[field, { decision: FIELD_DECISION.edited, input: { ...fieldReview.edited } }]];
		}),
	);
}

/** What Apply sends: a decision for every row, with the fields an accepted gift leaves out or edits. */
export function changeRowDecisions(
	rows: readonly Pick<ReviewRow, 'rowId'>[],
	review: ChangeReview,
): ChangeRowDecision[] {
	return rows.map(({ rowId }) => {
		const rowReview = review[rowId];
		if (!isRowIncluded(rowReview)) {
			return { rowId, decision: CHANGE_DECISION.rejected };
		}
		if (rowReview?.kind !== ROW_REVIEW_KIND.fields) {
			return { rowId, decision: CHANGE_DECISION.accepted };
		}
		const fields = appliedFieldDecisions(rowReview);
		return Object.keys(fields).length === 0
			? { rowId, decision: CHANGE_DECISION.accepted }
			: { rowId, decision: CHANGE_DECISION.accepted, fields };
	});
}

/** The status a row's badge shows, which also depends on the reviewer's decisions. */
export const CHANGE_ROW_DISPLAY_STATUS = {
	ready: 'ready',
	partial: 'partial',
	declined: 'declined',
	kept: 'kept',
	dropped: 'dropped',
	needsDecision: 'needsDecision',
	undecided: 'undecided',
	confirmed: 'confirmed',
	conflict: 'conflict',
	rejected: 'rejected',
	applied: 'applied',
	notApplied: 'notApplied',
	undone: 'undone',
	discarded: 'discarded',
	changedSinceApply: 'changedSinceApply',
} as const;

export type ChangeRowDisplayStatus =
	(typeof CHANGE_ROW_DISPLAY_STATUS)[keyof typeof CHANGE_ROW_DISPLAY_STATUS];

function pendingDisplayStatus(
	row: ReviewRow,
	rowReview: RowReview | undefined,
): ChangeRowDisplayStatus {
	if (rowUnresolvedCount(rowReview) > 0) {
		return row.requiresConfirmation
			? CHANGE_ROW_DISPLAY_STATUS.needsDecision
			: CHANGE_ROW_DISPLAY_STATUS.undecided;
	}
	if (rowReview?.kind === ROW_REVIEW_KIND.fields) {
		if (isGiftDropped(rowReview)) {
			return CHANGE_ROW_DISPLAY_STATUS.dropped;
		}
		const accepted = acceptedFieldCount(rowReview);
		if (accepted === 0) {
			return CHANGE_ROW_DISPLAY_STATUS.declined;
		}
		return accepted === Object.keys(rowReview.fields).length
			? CHANGE_ROW_DISPLAY_STATUS.ready
			: CHANGE_ROW_DISPLAY_STATUS.partial;
	}
	if (isRowIncluded(rowReview)) {
		return row.requiresConfirmation
			? CHANGE_ROW_DISPLAY_STATUS.confirmed
			: CHANGE_ROW_DISPLAY_STATUS.ready;
	}
	return row.kind === CHANGE_KIND.giftDeletion
		? CHANGE_ROW_DISPLAY_STATUS.kept
		: CHANGE_ROW_DISPLAY_STATUS.declined;
}

export function changeRowDisplayStatus(
	row: ReviewRow,
	context: {
		state: ChangeProposalState;
		rowReview: RowReview | undefined;
		changedSinceApply: boolean;
	},
): ChangeRowDisplayStatus {
	if (row.error !== null || row.status === CHANGE_ROW_STATUS.rejected) {
		return CHANGE_ROW_DISPLAY_STATUS.rejected;
	}
	if (row.status === CHANGE_ROW_STATUS.conflict) {
		return CHANGE_ROW_DISPLAY_STATUS.conflict;
	}
	if (context.changedSinceApply) {
		return CHANGE_ROW_DISPLAY_STATUS.changedSinceApply;
	}
	switch (row.status) {
		case CHANGE_ROW_STATUS.applied:
			return CHANGE_ROW_DISPLAY_STATUS.applied;
		case CHANGE_ROW_STATUS.notApplied:
			return CHANGE_ROW_DISPLAY_STATUS.notApplied;
		case CHANGE_ROW_STATUS.undone:
			return CHANGE_ROW_DISPLAY_STATUS.undone;
		case CHANGE_ROW_STATUS.ready:
		case CHANGE_ROW_STATUS.needsConfirmation:
			break;
	}
	if (context.state === CHANGE_PROPOSAL_STATE.discarded) {
		return CHANGE_ROW_DISPLAY_STATUS.discarded;
	}
	if (context.state === CHANGE_PROPOSAL_STATE.expired) {
		return CHANGE_ROW_DISPLAY_STATUS.notApplied;
	}
	return pendingDisplayStatus(row, context.rowReview);
}

/** The input key an editor writes; links and images are only accepted or rejected. */
const FIELD_EDITOR_KEY = {
	name: 'name',
	description: 'description',
	append: 'text',
	price: 'price',
	quantity: 'quantity',
	category: 'categoryId',
	priority: 'priorityLevelId',
	links: 'links',
	image: 'imageReference',
} as const satisfies Record<ChangeField, string>;

/** The editor's starting text for a field, from the proposed input or the reviewer's own. */
export function fieldEditorText(field: ChangeField, input: unknown): string {
	const value = changeInputRecord(input)?.[FIELD_EDITOR_KEY[field]];
	if (typeof value === 'number') {
		return String(value);
	}
	return typeof value === 'string' ? value : '';
}

const DECIMAL_COMMA = /,/g;
const MAX_PRICE_DECIMALS = 2;

function parsePrice(text: string): number | null | undefined {
	const trimmed = text.trim().replace(DECIMAL_COMMA, '.');
	if (trimmed === '') {
		return null;
	}
	const price = Number(trimmed);
	const decimals = trimmed.split('.')[1]?.length ?? 0;
	return Number.isFinite(price) && price >= 0 && decimals <= MAX_PRICE_DECIMALS
		? price
		: undefined;
}

function blankAsNull(text: string): string | null {
	const trimmed = text.trim();
	return trimmed === '' ? null : trimmed;
}

function whenFilled(
	text: string,
	input: (value: string) => Record<string, unknown>,
): Record<string, unknown> | null {
	const value = blankAsNull(text);
	return value === null ? null : input(value);
}

/** A price edit is one price, so it clears a proposed range and keeps the proposed currency. */
function priceEditInput(text: string, proposedInput: unknown): Record<string, unknown> | null {
	const price = parsePrice(text);
	if (price === undefined) {
		return null;
	}
	const currency = changeInputRecord(proposedInput)?.currency;
	return currency === undefined ? { price, priceMax: null } : { price, priceMax: null, currency };
}

function quantityEditInput(text: string): Record<string, unknown> | null {
	const quantity = Number(text.trim());
	return Number.isInteger(quantity) && quantity >= 1 ? { quantity } : null;
}

type FieldEditParser = (text: string, proposedInput: unknown) => Record<string, unknown> | null;

const FIELD_EDIT_PARSERS = {
	name: (text) => whenFilled(text, (name) => ({ name })),
	description: (text) => ({ description: blankAsNull(text) === null ? null : text }),
	append: (text) => whenFilled(text, (appended) => ({ text: appended })),
	price: priceEditInput,
	quantity: quantityEditInput,
	category: (text) => ({ categoryId: blankAsNull(text) }),
	priority: (text) => ({ priorityLevelId: blankAsNull(text) }),
	links: () => null,
	image: () => null,
} satisfies Record<ChangeField, FieldEditParser>;

/** The reviewer's value as the field's operation input, or null when it is not a valid value. */
export function fieldEditInput(
	field: ChangeField,
	text: string,
	proposedInput: unknown,
): Record<string, unknown> | null {
	return FIELD_EDIT_PARSERS[field](text, proposedInput);
}
