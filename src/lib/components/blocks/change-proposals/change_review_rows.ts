import {
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalRowView,
	type ChangeProposalState,
	type ChangeRowConflict,
	type ChangeRowError,
} from '$lib/modules/change_proposals/types.js';
import {
	CHANGE_ROW_GROUP,
	changeRowDisplayStatus,
	changeRowGroup,
	isSelectableChangeRow,
	type ChangeRowDisplayStatus,
	type ChangeRowGroup,
} from '$lib/modules/change_proposals/change_review_selection.js';
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

/** What the last Apply answered for rows that stopped applying; nothing applied in either case. */
export interface ApplyRowOutcomes {
	conflicts: ReadonlyMap<string, ChangeRowConflict[]>;
	errors: ReadonlyMap<string, ChangeRowError>;
}

export interface ReviewRowEntry {
	row: ChangeProposalRowView;
	model: ChangeRowModel;
	/** The section, fixed by the submitted row so a row that conflicts on apply stays in place. */
	group: ChangeRowGroup;
	/** The row never applies: a conflict or a rule failure, from the server or the last Apply. */
	blocked: boolean;
	status: ChangeRowDisplayStatus;
	selectable: boolean;
	selected: boolean;
	hidden: boolean;
	conflictedOnApply: boolean;
}

export interface ReviewRowsInput {
	rows: readonly ChangeProposalRowView[];
	state: ChangeProposalState;
	selection: ReadonlySet<string>;
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
		const model = buildChangeRowModel(row, input.context, input.lookups);
		const selectable = interactive && isSelectableChangeRow(row);
		const selected = selectable && input.selection.has(row.rowId);
		const blocked = changeRowGroup(row) === CHANGE_ROW_GROUP.blocked;
		const group = changeRowGroup(submittedRow);
		return {
			row,
			model,
			group,
			blocked,
			status: changeRowDisplayStatus(row, {
				state: input.state,
				selected,
				changedSinceApply: model.giftIds.some((giftId) => input.changedGiftIds.has(giftId)),
			}),
			selectable,
			selected,
			hidden: isHidden(input.filter, group, blocked),
			conflictedOnApply: row !== submittedRow && row.status === CHANGE_ROW_STATUS.conflict,
		};
	});
}
