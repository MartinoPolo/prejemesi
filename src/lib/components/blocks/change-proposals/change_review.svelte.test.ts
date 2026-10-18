import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	type ApplyChangeProposalResult,
	type ChangeProposalView,
	type UndoChangeProposalResult,
} from '$lib/modules/change_proposals/types.js';
import ChangeReview from './ChangeReview.svelte';

// Gift thumbnails import the images module barrel, which reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
import { appliedChangeProposal, changeProposal } from './change_review_test_data.js';

function renderReview(
	proposal: ChangeProposalView,
	handlers: {
		onapply?: (selectedRowIds: string[]) => Promise<ApplyChangeProposalResult>;
		onundo?: () => Promise<UndoChangeProposalResult>;
	} = {},
) {
	return render(ChangeReview, {
		proposal,
		wishlistTitle: 'Narozeniny Martina',
		recipientName: 'Martin Novák',
		listHref: '/w/bday2026',
		currentGifts: [],
		categories: [],
		priorityLevels: [],
		onapply: handlers.onapply ?? vi.fn(),
		onundo: handlers.onundo ?? vi.fn(),
		ondiscard: vi.fn(),
	});
}

function rowCheckbox(rowId: string) {
	const row = document.querySelector(`[data-testid="change-row"][data-row-id="${rowId}"]`);
	if (row === null) {
		throw new Error(`No change row ${rowId}`);
	}
	return page.elementLocator(row).getByRole('checkbox');
}

const applyButton = () => page.getByTestId('change-review-apply');
const selectAll = () => page.getByTestId('change-review-select-all');

describe('ChangeReview selection', () => {
	it('ticks ordinary rows only: confirmation rows wait and rejected rows cannot be ticked', async () => {
		await renderReview(changeProposal());

		await expect.element(rowCheckbox('r1')).toBeChecked();
		await expect.element(rowCheckbox('r2')).toBeChecked();
		await expect.element(rowCheckbox('r3')).not.toBeChecked();
		await expect.element(rowCheckbox('r3')).toBeEnabled();
		// Rows that never apply stay folded away until the conflicts filter opens them.
		await page.getByTestId('change-review-filter-conflicts').click();
		await expect.element(rowCheckbox('r4')).toBeDisabled();
		await expect
			.element(applyButton())
			.toHaveTextContent(m.change_review_apply_few({ count: 2 }));
	});

	it('shows a mixed selection and disables Apply once nothing is selected', async () => {
		await renderReview(changeProposal());

		await rowCheckbox('r2').click();
		await expect.element(selectAll()).toHaveAttribute('aria-checked', 'mixed');
		await expect.element(applyButton()).toHaveTextContent(m.change_review_apply_one());

		await rowCheckbox('r1').click();
		await expect.element(selectAll()).not.toBeChecked();
		await expect.element(applyButton()).toBeDisabled();

		await selectAll().click();
		await expect.element(selectAll()).toBeChecked();
		await expect.element(rowCheckbox('r3')).not.toBeChecked();
		await expect
			.element(applyButton())
			.toHaveTextContent(m.change_review_apply_few({ count: 2 }));
	});

	it('restates a selected confirmation row before applying it with the rest', async () => {
		const onapply = vi.fn().mockResolvedValue({
			outcome: CHANGE_PROPOSAL_OUTCOME.applied,
			proposal: appliedChangeProposal(),
		});
		await renderReview(changeProposal(), { onapply });

		await rowCheckbox('r3').click();
		await applyButton().click();
		const dialog = page.getByTestId('change-review-confirm-dialog');
		await expect
			.element(dialog.getByTestId('change-review-confirm-list'))
			.toHaveTextContent('Lego Titanic');
		expect(onapply).not.toHaveBeenCalled();

		await dialog.getByRole('button', { name: m.change_review_confirm_apply() }).click();
		expect(onapply).toHaveBeenCalledWith(['r1', 'r2', 'r3']);
	});
});

describe('ChangeReview apply results', () => {
	it('keeps the review open and takes a row that conflicted at apply out of the selection', async () => {
		const onapply = vi.fn().mockResolvedValue({
			outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
			rows: [
				{
					rowId: 'r2',
					conflicts: [
						{
							giftId: 'g-duna',
							changedByName: 'Jana',
							changedAt: new Date(),
							current: null,
						},
					],
				},
			],
		});
		await renderReview(changeProposal(), { onapply });

		await applyButton().click();

		await expect
			.element(page.getByTestId('change-review-apply-conflict'))
			.toHaveTextContent(m.change_review_apply_conflict_title_one());
		await expect.element(rowCheckbox('r2')).toBeDisabled();
		await expect.element(rowCheckbox('r1')).toBeChecked();
		await expect.element(applyButton()).toHaveTextContent(m.change_review_apply_one());
	});
});

describe('ChangeReview undo', () => {
	it('names the gifts that changed since apply when undo meets a conflict', async () => {
		const onundo = vi.fn().mockResolvedValue({
			outcome: CHANGE_PROPOSAL_OUTCOME.conflict,
			changedGifts: [{ giftId: 'g-duna', name: 'Kniha Duna (brožovaná)' }],
		});
		await renderReview(appliedChangeProposal(), { onundo });
		await expect.element(applyButton()).not.toBeInTheDocument();

		await page.getByRole('button', { name: m.change_review_undo() }).click();
		await page
			.getByTestId('change-review-undo-dialog')
			.getByRole('button', { name: m.change_review_undo() })
			.click();

		expect(onundo).toHaveBeenCalledOnce();
		const undoConflict = page.getByTestId('change-review-undo-conflict');
		await expect.element(undoConflict).toHaveTextContent(m.change_review_undo_conflict_body());
		await expect.element(undoConflict).toHaveTextContent('Kniha Duna (brožovaná)');
		await expect
			.element(
				page
					.getByTestId('change-review-applied')
					.getByRole('button', { name: m.change_review_undo() }),
			)
			.toBeDisabled();
	});

	it('offers no undo once undo is unavailable, and reports an undone batch', async () => {
		const review = await renderReview(
			appliedChangeProposal({ undo: { available: false, blockingRowIds: ['r1'] } }),
		);
		await expect
			.element(page.getByTestId('change-review-applied'))
			.toHaveTextContent(m.change_review_undo_unavailable());
		await expect
			.element(page.getByRole('button', { name: m.change_review_undo() }))
			.not.toBeInTheDocument();

		await review.rerender({
			proposal: appliedChangeProposal({
				state: CHANGE_PROPOSAL_STATE.undone,
				undoneAt: new Date(),
				undo: null,
			}),
		});
		await expect.element(page.getByTestId('change-review-undone')).toBeVisible();
		await expect.element(page.getByTestId('change-review-applied')).not.toBeInTheDocument();
	});
});
