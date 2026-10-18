import {
	CHANGE_PROPOSAL_STATE,
	CHANGE_ROW_STATUS,
	type ChangeProposalRowView,
	type ChangeProposalState,
} from './types.js';

type ReviewRow = Pick<ChangeProposalRowView, 'rowId' | 'status' | 'requiresConfirmation' | 'error'>;

/** Where a row sits on the review page: confirmation rows first, rows that never apply last. */
export const CHANGE_ROW_GROUP = {
	confirm: 'confirm',
	ordinary: 'ordinary',
	blocked: 'blocked',
} as const;

export type ChangeRowGroup = (typeof CHANGE_ROW_GROUP)[keyof typeof CHANGE_ROW_GROUP];

/** The status a row's badge shows, which also depends on the reviewer's selection. */
export const CHANGE_ROW_DISPLAY_STATUS = {
	ready: 'ready',
	unselected: 'unselected',
	needsConfirmation: 'needsConfirmation',
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

/** Only ready and confirmation rows can be ticked; conflicts and rejected rows never apply. */
export function isSelectableChangeRow(row: Pick<ReviewRow, 'status'>): boolean {
	return (
		row.status === CHANGE_ROW_STATUS.ready || row.status === CHANGE_ROW_STATUS.needsConfirmation
	);
}

export function changeRowGroup(row: ReviewRow): ChangeRowGroup {
	if (
		row.error !== null ||
		row.status === CHANGE_ROW_STATUS.conflict ||
		row.status === CHANGE_ROW_STATUS.rejected
	) {
		return CHANGE_ROW_GROUP.blocked;
	}
	return row.requiresConfirmation ? CHANGE_ROW_GROUP.confirm : CHANGE_ROW_GROUP.ordinary;
}

/** Ordinary rows start ticked; deletions, reservations and invitations wait for the reviewer. */
export function initialChangeSelection(rows: readonly ReviewRow[]): Set<string> {
	return new Set(
		rows.filter((row) => row.status === CHANGE_ROW_STATUS.ready).map((row) => row.rowId),
	);
}

/** The rows Apply sends, in submission order; a row that stopped being selectable drops out. */
export function selectedChangeRowIds(
	rows: readonly ReviewRow[],
	selection: ReadonlySet<string>,
): string[] {
	return rows
		.filter((row) => isSelectableChangeRow(row) && selection.has(row.rowId))
		.map((row) => row.rowId);
}

export function selectableChangeRowCount(rows: readonly ReviewRow[]): number {
	return rows.filter(isSelectableChangeRow).length;
}

function ordinarySelectableRows(rows: readonly ReviewRow[]): ReviewRow[] {
	return rows.filter((row) => isSelectableChangeRow(row) && !row.requiresConfirmation);
}

/** "Vybrat vše" covers ordinary rows only: checked when all are ticked, mixed when some are. */
export function ordinarySelectionState(
	rows: readonly ReviewRow[],
	selection: ReadonlySet<string>,
): { checked: boolean; indeterminate: boolean } {
	const ordinaryRows = ordinarySelectableRows(rows);
	const selectedCount = ordinaryRows.filter((row) => selection.has(row.rowId)).length;
	return {
		checked: selectedCount > 0 && selectedCount === ordinaryRows.length,
		indeterminate: selectedCount > 0 && selectedCount < ordinaryRows.length,
	};
}

/** Ticks every ordinary row, or unticks them all once all are ticked; confirmation rows stay. */
export function toggleOrdinarySelection(
	rows: readonly ReviewRow[],
	selection: ReadonlySet<string>,
): Set<string> {
	const ordinaryRowIds = ordinarySelectableRows(rows).map((row) => row.rowId);
	const allSelected = ordinaryRowIds.every((rowId) => selection.has(rowId));
	const nextSelection = new Set(selection);
	for (const rowId of ordinaryRowIds) {
		if (allSelected) {
			nextSelection.delete(rowId);
		} else {
			nextSelection.add(rowId);
		}
	}
	return nextSelection;
}

export function withChangeRowSelected(
	selection: ReadonlySet<string>,
	rowId: string,
	selected: boolean,
): Set<string> {
	const nextSelection = new Set(selection);
	if (selected) {
		nextSelection.add(rowId);
	} else {
		nextSelection.delete(rowId);
	}
	return nextSelection;
}

export function changeRowDisplayStatus(
	row: ReviewRow,
	context: { state: ChangeProposalState; selected: boolean; changedSinceApply: boolean },
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
	if (row.status === CHANGE_ROW_STATUS.needsConfirmation) {
		return context.selected
			? CHANGE_ROW_DISPLAY_STATUS.confirmed
			: CHANGE_ROW_DISPLAY_STATUS.needsConfirmation;
	}
	return context.selected
		? CHANGE_ROW_DISPLAY_STATUS.ready
		: CHANGE_ROW_DISPLAY_STATUS.unselected;
}
