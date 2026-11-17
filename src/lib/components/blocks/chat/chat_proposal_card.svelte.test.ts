import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { CHANGE_ROW_STATUS, type ChangeProposalView } from '$lib/modules/change_proposals/types.js';
import type { DecidingProposalRegistry } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
import {
	changeProposal,
	deletionChangeProposal,
} from '$lib/components/blocks/change-proposals/change_review_test_data.js';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import type { DecisionBarControls } from './chat_presentation.js';
import {
	discardChangeProposal,
	restoreChangeProposal,
} from '$lib/modules/change_proposals/change_proposals.remote.js';
import { showRejectedProposalToast } from '$lib/components/blocks/change-proposals/rejected_proposal_toast.js';
import ChatProposalCard from './ChatProposalCard.svelte';

// Gift thumbnails import the images module barrel, which reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/change_proposals/change_proposals.remote.js', () => ({
	applyChangeProposal: vi.fn(),
	discardChangeProposal: vi.fn(),
	getChangeProposal: vi.fn(),
	getPendingChangeProposals: vi.fn(),
	restoreChangeProposal: vi.fn(),
	undoChangeProposal: vi.fn(),
}));
vi.mock('$lib/components/blocks/change-proposals/rejected_proposal_toast.js', () => ({
	showRejectedProposalToast: vi.fn(),
}));

function renderCard(proposal: ChangeProposalView, { inBar = false } = {}) {
	const decisionBar = new StateRaw<DecisionBarControls | null>(null);
	const decidingProposals: DecidingProposalRegistry = new Set();
	render(ChatProposalCard, {
		proposal,
		rowContext: { currentGifts: [], categories: [], priorityLevels: [] },
		inBar,
		decisionBar,
		decidingProposals,
		onoutdated: vi.fn(),
	});
	return { decisionBar };
}

const card = () => page.getByTestId('chat-proposal');

describe('ChatProposalCard decision bar', () => {
	it('hands the controls of the proposal the bar serves to the bar', async () => {
		const { decisionBar } = renderCard(changeProposal(), { inBar: true });

		await expect.element(card()).toBeInTheDocument();
		await expect.poll(() => decisionBar.current).not.toBeNull();
		await expect.element(card().getByTestId('chat-proposal-controls')).not.toBeInTheDocument();
	});

	it('keeps its own controls when the bar serves another proposal', async () => {
		const { decisionBar } = renderCard(changeProposal());

		await expect.element(card().getByTestId('chat-proposal-controls')).toBeInTheDocument();
		expect(decisionBar.current).toBeNull();
	});
});

const DELETION_GROUP = () =>
	m.change_review_row_decision_label({
		kind: m.change_review_kind_gift_deletion(),
		name: 'Lego Titanic',
	});
const deletionDecision = () => card().getByRole('group', { name: DELETION_GROUP() });
const deletionChoice = (name: string) =>
	deletionDecision().getByRole('button', { name, exact: true });
const deletionWarning = () =>
	card().getByText(m.change_review_deletion_consequence({ name: 'Lego Titanic' }));

describe('ChatProposalCard bulk decisions', () => {
	it('offers only Zamítnout vše when every row needs its own confirmation', async () => {
		renderCard(deletionChangeProposal());

		await expect.element(card().getByTestId('chat-proposal-reject-all')).toBeInTheDocument();
		await expect
			.element(card().getByTestId('chat-proposal-accept-all'))
			.not.toBeInTheDocument();
	});

	it('rejects the whole proposal in one click and offers to restore it', async () => {
		const proposal = changeProposal();
		vi.mocked(discardChangeProposal).mockResolvedValue(proposal as never);
		vi.mocked(restoreChangeProposal).mockResolvedValue(proposal as never);
		vi.mocked(showRejectedProposalToast).mockClear();
		renderCard(proposal);

		await card().getByTestId('chat-proposal-reject-all').click();

		await expect
			.poll(() => vi.mocked(discardChangeProposal).mock.calls)
			.toEqual([[{ proposalId: proposal.id }]]);
		await expect.poll(() => vi.mocked(showRejectedProposalToast).mock.calls.length).toBe(1);
		const [restore] = vi.mocked(showRejectedProposalToast).mock.calls[0] ?? [];
		await restore?.();
		expect(restoreChangeProposal).toHaveBeenCalledWith({ proposalId: proposal.id });
	});

	it('rejects the proposal with the same undo once every row was rejected one by one', async () => {
		const proposal = deletionChangeProposal();
		vi.mocked(discardChangeProposal)
			.mockClear()
			.mockResolvedValue(proposal as never);
		vi.mocked(showRejectedProposalToast).mockClear();
		renderCard(proposal);

		await card().getByTestId('chat-proposal-inspect').click();
		await deletionChoice(m.change_review_choice_keep()).click();
		await card().getByTestId('chat-proposal-apply').click();

		await expect
			.poll(() => vi.mocked(discardChangeProposal).mock.calls)
			.toEqual([[{ proposalId: proposal.id }]]);
		await expect.poll(() => vi.mocked(showRejectedProposalToast).mock.calls.length).toBe(1);
	});

	it('says it is rejecting, not applying, while Zamítnout vše runs', async () => {
		const proposal = changeProposal();
		let finishRejection: (value: never) => void = () => {};
		vi.mocked(discardChangeProposal).mockReturnValue(
			new Promise((resolve) => (finishRejection = resolve)) as never,
		);
		renderCard(proposal);

		await card().getByTestId('chat-proposal-reject-all').click();

		const apply = card().getByTestId('chat-proposal-apply');
		await expect.element(apply).toHaveTextContent(m.change_review_rejecting());
		await expect.element(apply).not.toHaveTextContent(m.change_review_applying());
		finishRejection(proposal as never);
	});

	it('offers no undo when the rejection fails', async () => {
		vi.mocked(discardChangeProposal).mockClear().mockRejectedValue(new Error('offline'));
		vi.mocked(showRejectedProposalToast).mockClear();
		renderCard(changeProposal());

		await card().getByTestId('chat-proposal-reject-all').click();

		await expect.poll(() => vi.mocked(discardChangeProposal).mock.calls.length).toBe(1);
		await expect.element(card().getByTestId('chat-proposal-reject-all')).toBeEnabled();
		expect(showRejectedProposalToast).not.toHaveBeenCalled();
	});

	it('accepts only the ordinary rows with Přijmout vše', async () => {
		const proposal = changeProposal();
		const ordinaryRowCount = proposal.rows.filter(
			(row) => row.status === CHANGE_ROW_STATUS.ready,
		).length;
		renderCard(proposal);

		await card().getByTestId('chat-proposal-accept-all').click();
		await expect
			.element(card().getByTestId('chat-proposal-apply'))
			.toHaveTextContent(m.change_review_apply_included({ count: ordinaryRowCount }));
	});

	it('leaves an undecided deletion visibly awaiting its own action after Přijmout vše', async () => {
		renderCard(changeProposal());

		await card().getByTestId('chat-proposal-accept-all').click();

		await expect.element(card().getByTestId('chat-proposal-unresolved')).toBeVisible();
		await expect.element(card().getByTestId('chat-proposal-row').first()).toBeVisible();
		await expect
			.element(deletionChoice(m.change_review_choice_delete()))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('warns about the deletion only while the gift may still be deleted', async () => {
		renderCard(deletionChangeProposal());

		await card().getByTestId('chat-proposal-inspect').click();
		await expect.element(deletionWarning()).toBeVisible();

		await deletionChoice(m.change_review_choice_keep()).click();
		await expect.element(deletionWarning()).not.toBeInTheDocument();

		await deletionChoice(m.change_review_choice_keep()).click();
		await expect.element(deletionWarning()).toBeVisible();
	});
});
