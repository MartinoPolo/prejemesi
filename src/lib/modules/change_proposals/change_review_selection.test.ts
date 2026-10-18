import { describe, expect, it } from 'vitest';
import {
	CHANGE_ROW_DISPLAY_STATUS,
	CHANGE_ROW_GROUP,
	changeRowDisplayStatus,
	changeRowGroup,
	initialChangeSelection,
	ordinarySelectionState,
	selectedChangeRowIds,
	toggleOrdinarySelection,
	withChangeRowSelected,
} from './change_review_selection.js';
import { CHANGE_PROPOSAL_STATE, CHANGE_ROW_STATUS, type ChangeRowStatus } from './types.js';

function reviewRow(rowId: string, status: ChangeRowStatus, requiresConfirmation = false) {
	return {
		rowId,
		status,
		requiresConfirmation,
		error:
			status === CHANGE_ROW_STATUS.rejected
				? { status: 400, code: 'CANNOT_EDIT_AFTER_SHARING', details: {} }
				: null,
	};
}

const rows = [
	reviewRow('r1', CHANGE_ROW_STATUS.ready),
	reviewRow('r2', CHANGE_ROW_STATUS.needsConfirmation, true),
	reviewRow('r3', CHANGE_ROW_STATUS.ready),
	reviewRow('r4', CHANGE_ROW_STATUS.conflict),
	reviewRow('r5', CHANGE_ROW_STATUS.rejected),
];

describe('change review selection', () => {
	it('starts with ordinary rows ticked and confirmation, conflict and rejected rows unticked', () => {
		expect([...initialChangeSelection(rows)]).toEqual(['r1', 'r3']);
	});

	it('never applies conflict or rejected rows, even when their ids are in the selection', () => {
		const selection = new Set(['r1', 'r2', 'r4', 'r5']);
		expect(selectedChangeRowIds(rows, selection)).toEqual(['r1', 'r2']);
	});

	it('applies a confirmation row only once it is ticked', () => {
		const initial = initialChangeSelection(rows);
		expect(selectedChangeRowIds(rows, initial)).not.toContain('r2');
		expect(selectedChangeRowIds(rows, withChangeRowSelected(initial, 'r2', true))).toEqual([
			'r1',
			'r2',
			'r3',
		]);
	});

	it('reports a mixed master checkbox when some ordinary rows are unticked', () => {
		const mixed = withChangeRowSelected(initialChangeSelection(rows), 'r3', false);
		expect(ordinarySelectionState(rows, mixed)).toEqual({
			checked: false,
			indeterminate: true,
		});
		expect(ordinarySelectionState(rows, initialChangeSelection(rows))).toEqual({
			checked: true,
			indeterminate: false,
		});
	});

	it('lets "select all" tick and untick only ordinary rows', () => {
		const withConfirmation = new Set(['r2']);
		const allOrdinary = toggleOrdinarySelection(rows, withConfirmation);
		expect([...allOrdinary].sort()).toEqual(['r1', 'r2', 'r3']);

		const nothingOrdinary = toggleOrdinarySelection(rows, allOrdinary);
		expect([...nothingOrdinary]).toEqual(['r2']);
	});

	it('sends nothing when every row is unticked', () => {
		const nothing = toggleOrdinarySelection(rows, initialChangeSelection(rows));
		expect(selectedChangeRowIds(rows, nothing)).toEqual([]);
		expect(ordinarySelectionState(rows, nothing)).toEqual({
			checked: false,
			indeterminate: false,
		});
	});

	it('groups confirmation rows first and conflict or rejected rows last', () => {
		expect(rows.map(changeRowGroup)).toEqual([
			CHANGE_ROW_GROUP.ordinary,
			CHANGE_ROW_GROUP.confirm,
			CHANGE_ROW_GROUP.ordinary,
			CHANGE_ROW_GROUP.blocked,
			CHANGE_ROW_GROUP.blocked,
		]);
	});
});

describe('change row display status', () => {
	const pending = { state: CHANGE_PROPOSAL_STATE.pending, changedSinceApply: false };

	it('follows the selection while the proposal is pending', () => {
		const [ready, confirmation] = rows;
		expect(changeRowDisplayStatus(ready!, { ...pending, selected: true })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.ready,
		);
		expect(changeRowDisplayStatus(ready!, { ...pending, selected: false })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.unselected,
		);
		expect(changeRowDisplayStatus(confirmation!, { ...pending, selected: false })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.needsConfirmation,
		);
		expect(changeRowDisplayStatus(confirmation!, { ...pending, selected: true })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.confirmed,
		);
	});

	it('keeps conflict and rejected rows as such whatever the selection', () => {
		expect(changeRowDisplayStatus(rows[3]!, { ...pending, selected: true })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.conflict,
		);
		expect(changeRowDisplayStatus(rows[4]!, { ...pending, selected: true })).toBe(
			CHANGE_ROW_DISPLAY_STATUS.rejected,
		);
	});

	it('reads applied, not applied and undone rows after the proposal settles', () => {
		const applied = { state: CHANGE_PROPOSAL_STATE.applied, selected: false };
		expect(
			changeRowDisplayStatus(reviewRow('r1', CHANGE_ROW_STATUS.applied), {
				...applied,
				changedSinceApply: false,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.applied);
		expect(
			changeRowDisplayStatus(reviewRow('r1', CHANGE_ROW_STATUS.applied), {
				...applied,
				changedSinceApply: true,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.changedSinceApply);
		expect(
			changeRowDisplayStatus(reviewRow('r2', CHANGE_ROW_STATUS.notApplied), {
				...applied,
				changedSinceApply: false,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.notApplied);
		expect(
			changeRowDisplayStatus(reviewRow('r1', CHANGE_ROW_STATUS.undone), {
				state: CHANGE_PROPOSAL_STATE.undone,
				selected: false,
				changedSinceApply: false,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.undone);
	});

	it('shows discarded and expired rows as unapplied', () => {
		expect(
			changeRowDisplayStatus(rows[0]!, {
				state: CHANGE_PROPOSAL_STATE.discarded,
				selected: true,
				changedSinceApply: false,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.discarded);
		expect(
			changeRowDisplayStatus(rows[0]!, {
				state: CHANGE_PROPOSAL_STATE.expired,
				selected: true,
				changedSinceApply: false,
			}),
		).toBe(CHANGE_ROW_DISPLAY_STATUS.notApplied);
	});
});
