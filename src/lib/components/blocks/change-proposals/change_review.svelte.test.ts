import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	type ApplyChangeProposalResult,
	type ChangeProposalView,
	type UndoChangeProposalResult,
} from '$lib/modules/change_proposals/types.js';
import type { ChangeRowDecision } from '$lib/modules/change_proposals/change_field_decisions.js';
import { CHANGE_ROW_DISPLAY_STATUS } from '$lib/modules/change_proposals/change_review_decisions.js';
import ChangeReview from './ChangeReview.svelte';

// Gift thumbnails import the images module barrel, which reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
import { appliedChangeProposal, changeProposal } from './change_review_test_data.js';

function renderReview(
	proposal: ChangeProposalView,
	handlers: {
		onapply?: (decisions: ChangeRowDecision[]) => Promise<ApplyChangeProposalResult>;
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

function changeRow(rowId: string) {
	const row = document.querySelector(`[data-testid="change-row"][data-row-id="${rowId}"]`);
	if (row === null) {
		throw new Error(`No change row ${rowId}`);
	}
	return page.elementLocator(row);
}

const rowButton = (rowId: string, name: string) =>
	changeRow(rowId).getByRole('button', { name, exact: true });
const fieldAccept = (rowId: string, field: string) =>
	rowButton(rowId, m.change_review_field_accept_label({ field }));
const fieldReject = (rowId: string, field: string) =>
	rowButton(rowId, m.change_review_field_reject_label({ field }));
const fieldEdit = (rowId: string, field: string) =>
	rowButton(rowId, m.change_review_field_edit_label({ field }));
const applyButton = () => page.getByTestId('change-review-apply');
const appliedResult = () =>
	vi.fn().mockResolvedValue({
		outcome: CHANGE_PROPOSAL_OUTCOME.applied,
		proposal: appliedChangeProposal(),
	});

const NAME = m.change_review_field_name();
const PRICE = m.change_review_field_price();
const QUANTITY = m.change_review_field_quantity();

describe('ChangeReview decisions', () => {
	it('preselects edits and new gifts as accepted and leaves a deletion to the reviewer', async () => {
		await renderReview(changeProposal());

		await expect.element(fieldAccept('r1', PRICE)).toHaveAttribute('aria-pressed', 'true');
		await expect.element(fieldAccept('r2', QUANTITY)).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(changeRow('r3'))
			.toHaveAttribute('data-status', CHANGE_ROW_DISPLAY_STATUS.needsDecision);
		await expect
			.element(rowButton('r3', m.change_review_choice_delete()))
			.toHaveAttribute('aria-pressed', 'false');
		await expect.element(applyButton()).toHaveAttribute('aria-disabled', 'true');
		await expect
			.element(page.getByRole('region', { name: m.change_review_apply_bar_label() }))
			.toHaveTextContent(m.change_review_unresolved_help_one());
	});

	it('points at the open decision instead of applying while one is left', async () => {
		const onapply = appliedResult();
		await renderReview(changeProposal(), { onapply });

		// Playwright refuses aria-disabled targets, so the pointer click skips its enabled check.
		await applyButton().click({ force: true });

		expect(onapply).not.toHaveBeenCalled();
		await expect
			.element(page.getByTestId('change-review-unresolved-message'))
			.toHaveTextContent(m.change_review_unresolved_message_one());
		await expect.element(rowButton('r3', m.change_review_choice_delete())).toHaveFocus();
		await expect
			.element(
				changeRow('r3').getByRole('group', {
					name: m.change_review_row_decision_label({
						kind: m.change_review_kind_gift_deletion(),
						name: 'Lego Titanic',
					}),
				}),
			)
			.toHaveClass('needs-decision');
	});

	it('never resolves a deletion with the global Přijmout vše', async () => {
		await renderReview(changeProposal());

		await page.getByTestId('change-review-reject-all').click();
		await expect.element(fieldAccept('r2', QUANTITY)).toHaveAttribute('aria-pressed', 'false');
		await expect
			.element(rowButton('r3', m.change_review_choice_keep()))
			.toHaveAttribute('aria-pressed', 'true');

		await page.getByTestId('change-review-accept-all').click();
		await expect.element(fieldAccept('r2', QUANTITY)).toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(rowButton('r3', m.change_review_choice_keep()))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(rowButton('r3', m.change_review_choice_delete()))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('applies only the accepted fields, with the reviewer’s own values', async () => {
		const onapply = appliedResult();
		await renderReview(changeProposal(), { onapply });

		await fieldReject('r2', QUANTITY).click();
		await fieldEdit('r1', PRICE).click();
		const priceInput = changeRow('r1').getByRole('textbox', { name: PRICE });
		await priceInput.fill('990');
		await userEvent.keyboard('{Enter}');
		await expect.element(changeRow('r1')).toHaveTextContent(m.change_review_pill_edited());
		await rowButton('r3', m.change_review_choice_delete()).click();
		await expect.element(applyButton()).not.toHaveAttribute('aria-disabled');
		await applyButton().click();

		expect(onapply).toHaveBeenCalledWith([
			{
				rowId: 'r1',
				decision: 'accepted',
				fields: {
					price: {
						decision: 'edited',
						input: { price: 990, priceMax: null, currency: 'CZK' },
					},
				},
			},
			{ rowId: 'r2', decision: 'accepted', fields: { quantity: { decision: 'rejected' } } },
			{ rowId: 'r3', decision: 'accepted' },
			{ rowId: 'r4', decision: 'rejected' },
		]);
	});

	it('keeps a new gift’s name until every other field is rejected, then leaves the gift out', async () => {
		await renderReview(changeProposal());

		await expect.element(fieldReject('r1', NAME)).toBeDisabled();
		await fieldReject('r1', PRICE).click();
		await expect
			.element(changeRow('r1'))
			.toHaveAttribute('data-status', CHANGE_ROW_DISPLAY_STATUS.dropped);
		await expect.element(changeRow('r1')).toHaveTextContent(m.change_review_ghost_dropped());

		await fieldAccept('r1', NAME).click();
		await expect
			.element(changeRow('r1'))
			.toHaveAttribute('data-status', CHANGE_ROW_DISPLAY_STATUS.ready);
		await expect.element(fieldAccept('r1', PRICE)).toHaveAttribute('aria-pressed', 'true');
	});

	it('offers to reject the proposal once everything is rejected', async () => {
		await renderReview(changeProposal());

		await page.getByTestId('change-review-reject-all').click();
		await expect.element(applyButton()).toHaveTextContent(m.change_review_decline_proposal());
		await applyButton().click();

		await expect.element(page.getByTestId('change-review-discard-dialog')).toBeVisible();
	});
});

describe('ChangeReview apply results', () => {
	it('keeps the decisions and drops a row that conflicted at apply', async () => {
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

		await rowButton('r3', m.change_review_choice_keep()).click();
		await applyButton().click();

		await expect
			.element(page.getByTestId('change-review-apply-conflict'))
			.toHaveTextContent(m.change_review_apply_conflict_title_one());
		await expect
			.element(changeRow('r2'))
			.toHaveAttribute('data-status', CHANGE_ROW_DISPLAY_STATUS.conflict);
		await expect
			.element(rowButton('r3', m.change_review_choice_keep()))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(applyButton())
			.toHaveTextContent(m.change_review_apply_included({ count: 1 }));
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
