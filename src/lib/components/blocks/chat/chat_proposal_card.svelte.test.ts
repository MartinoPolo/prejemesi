import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import type { ChangeProposalView } from '$lib/modules/change_proposals/types.js';
import type { DecidingProposalRegistry } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
import { changeProposal } from '$lib/components/blocks/change-proposals/change_review_test_data.js';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import type { DecisionBarControls } from './chat_presentation.js';
import ChatProposalCard from './ChatProposalCard.svelte';

// Gift thumbnails import the images module barrel, which reads `$env/dynamic/public`.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/change_proposals/change_proposals.remote.js', () => ({
	applyChangeProposal: vi.fn(),
	discardChangeProposal: vi.fn(),
	getChangeProposal: vi.fn(),
	getPendingChangeProposals: vi.fn(),
	undoChangeProposal: vi.fn(),
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
