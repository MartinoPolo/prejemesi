import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ApplyChangeProposalResult,
	type ChangeProposalRowView,
	type ChangeProposalState,
	type ChangeRowConflict,
	type ChangeRowError,
} from '$lib/modules/change_proposals/types.js';
import {
	CHANGE_ROW_GROUP,
	changeRowDisplayStatus,
	changeRowGroup,
	isDecidableChangeRow,
	isRowIncluded,
	rowUnresolvedCount,
	type ChangeReview,
	type ChangeRowDisplayStatus,
	type ChangeRowGroup,
	type RowReview,
} from '$lib/modules/change_proposals/change_review_decisions.js';
import type {
	ChangeDecision,
	ChangeField,
} from '$lib/modules/change_proposals/change_field_decisions.js';
import type { GiftLabelLookups } from '$lib/modules/change_proposals/change_review_diffs.js';
import {
	buildChangeRowModel,
	type ChangeRowContext,
	type ChangeRowModel,
} from './change_row_model.js';

export const CHANGE_REVIEW_FILTER = {
	all: 'all',
	confirm: 'confirm',
	conflicts: 'conflicts',
} as const;

export type ChangeReviewFilter = (typeof CHANGE_REVIEW_FILTER)[keyof typeof CHANGE_REVIEW_FILTER];

export function isChangeReviewFilter(value: string): value is ChangeReviewFilter {
	return Object.values<string>(CHANGE_REVIEW_FILTER).includes(value);
}

/** The reviewer's decisions on an open proposal, by row and field. */
export interface ChangeReviewActions {
	decideRow: (rowId: string, decision: ChangeDecision) => void;
	chooseRow: (rowId: string, accepted: boolean) => void;
	toggleField: (rowId: string, field: ChangeField, decision: ChangeDecision) => void;
	/** Saves the field editor; false when the text is not a valid value. */
	editField: (rowId: string, field: ChangeField, text: string) => boolean;
}

/** What the last Apply answered for rows that stopped applying; nothing applied in either case. */
export interface ApplyRowOutcomes {
	conflicts: ReadonlyMap<string, ChangeRowConflict[]>;
	errors: ReadonlyMap<string, ChangeRowError>;
}

export const NO_APPLY_ROW_OUTCOMES: ApplyRowOutcomes = { conflicts: new Map(), errors: new Map() };

/** The rows that stopped an Apply, or none once it applied. */
export function applyRowOutcomes(result: ApplyChangeProposalResult): ApplyRowOutcomes {
	if (result.outcome === CHANGE_PROPOSAL_OUTCOME.conflict) {
		return {
			conflicts: new Map(result.rows.map((row) => [row.rowId, row.conflicts])),
			errors: new Map(),
		};
	}
	if (result.outcome === CHANGE_PROPOSAL_OUTCOME.failed) {
		return {
			conflicts: new Map(),
			errors: new Map(result.rows.map((row) => [row.rowId, row.error])),
		};
	}
	return NO_APPLY_ROW_OUTCOMES;
}

export interface ReviewRowEntry {
	row: ChangeProposalRowView;
	model: ChangeRowModel;
	/** The section, fixed by the submitted row so a row that conflicts on apply stays in place. */
	group: ChangeRowGroup;
	/** The row never applies: a conflict or a rule failure, from the server or the last Apply. */
	blocked: boolean;
	status: ChangeRowDisplayStatus;
	/** The reviewer's decision, absent for rows that take none. */
	rowReview: RowReview | undefined;
	/** The row would apply as decided. */
	included: boolean;
	unresolvedCount: number;
	hidden: boolean;
	conflictedOnApply: boolean;
}

export interface ReviewRowsInput {
	rows: readonly ChangeProposalRowView[];
	state: ChangeProposalState;
	review: ChangeReview;
	filter: ChangeReviewFilter;
	applyOutcomes: ApplyRowOutcomes;
	/** Gifts that changed since apply, which is why undo refused. */
	changedGiftIds: ReadonlySet<string>;
	context: ChangeRowContext;
	lookups: GiftLabelLookups;
}

/** A pending row overlaid with what the last Apply reported for it. */
function withApplyOutcome(
	row: ChangeProposalRowView,
	outcomes: ApplyRowOutcomes,
): ChangeProposalRowView {
	const error = outcomes.errors.get(row.rowId);
	if (error !== undefined) {
		return { ...row, status: CHANGE_ROW_STATUS.rejected, error };
	}
	const conflicts = outcomes.conflicts.get(row.rowId);
	if (conflicts !== undefined) {
		return { ...row, status: CHANGE_ROW_STATUS.conflict, conflicts };
	}
	return row;
}

function isHidden(filter: ChangeReviewFilter, group: ChangeRowGroup, blocked: boolean): boolean {
	switch (filter) {
		case CHANGE_REVIEW_FILTER.confirm:
			return group !== CHANGE_ROW_GROUP.confirm;
		case CHANGE_REVIEW_FILTER.conflicts:
			return !blocked;
		default:
			return false;
	}
}

export function buildReviewRowEntries(input: ReviewRowsInput): ReviewRowEntry[] {
	const interactive = input.state === CHANGE_PROPOSAL_STATE.pending;
	return input.rows.map((submittedRow) => {
		const row = interactive
			? withApplyOutcome(submittedRow, input.applyOutcomes)
			: submittedRow;
		const decidable = !interactive || isDecidableChangeRow(row);
		const rowReview = decidable ? input.review[row.rowId] : undefined;
		const model = buildChangeRowModel(row, input.context, input.lookups, rowReview);
		const blocked = changeRowGroup(row) === CHANGE_ROW_GROUP.blocked;
		const group = changeRowGroup(submittedRow);
		return {
			row,
			model,
			group,
			blocked,
			status: changeRowDisplayStatus(row, {
				state: input.state,
				rowReview,
				changedSinceApply: model.giftIds.some((giftId) => input.changedGiftIds.has(giftId)),
			}),
			rowReview,
			included: isRowIncluded(rowReview),
			unresolvedCount: interactive ? rowUnresolvedCount(rowReview) : 0,
			hidden: isHidden(input.filter, group, blocked),
			conflictedOnApply: row !== submittedRow && row.status === CHANGE_ROW_STATUS.conflict,
		};
	});
}

/** The decisions of rows that can still apply; a row that conflicted on Apply drops out. */
export function activeChangeReview(entries: readonly ReviewRowEntry[]): ChangeReview {
	return Object.fromEntries(
		entries.flatMap((entry) =>
			entry.rowReview === undefined ? [] : [[entry.row.rowId, entry.rowReview]],
		),
	);
}
