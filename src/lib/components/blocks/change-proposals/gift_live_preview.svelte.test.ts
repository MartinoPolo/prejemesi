import { describe, expect, it } from 'vitest';
import { SvelteSet } from 'svelte/reactivity';
import { CHANGE_DECISION } from '$lib/modules/change_proposals/change_field_decisions.js';
import type { ChangeProposalView } from '$lib/modules/change_proposals/types.js';
import type { GiftForRecipient } from '$lib/modules/gifts/types.js';
import { GIFT_LIVE_PREVIEW } from './change_row_model.js';
import {
	NO_GIFT_LIVE_PREVIEWS,
	giftLivePreviews,
	previewedGift,
	type DecidingProposal,
	type DecidingProposalRegistry,
} from './gift_live_preview.js';
import { ProposalDecisions } from './proposal_decisions.svelte.js';
import { changeProposal } from './change_review_test_data.js';

function decide(proposal: ChangeProposalView = changeProposal()) {
	return new ProposalDecisions({
		proposal: () => proposal,
		context: () => ({
			currentGifts: [],
			categories: [],
			priorityLevels: [],
			submitterName: proposal.submitterName,
			kindTitle: (kind) => kind,
		}),
	});
}

function registration(proposalId: string, decisions: ProposalDecisions): DecidingProposal {
	return { proposalId, entries: () => decisions.entries };
}

function previewsOf(...decisions: ProposalDecisions[]) {
	const registry: DecidingProposalRegistry = new SvelteSet();
	decisions.forEach((proposalDecisions, index) => {
		registry.add(registration(`proposal-${index + 1}`, proposalDecisions));
	});
	return giftLivePreviews(registry);
}

function storedGift(overrides: Partial<GiftForRecipient>): GiftForRecipient {
	return { ...previewsOf(decide()).creations[0].gift, ...overrides };
}

describe('gift live preview while a proposal is decided', () => {
	it('shows the preselected result: edited gifts, a ghost new gift and the pending deletion', () => {
		const previews = previewsOf(decide());

		expect(previews.edits.get('g-duna')).toEqual(
			expect.objectContaining({ name: 'Kniha Duna (brožovaná)', quantity: 2 }),
		);
		expect(previews.creations).toHaveLength(1);
		expect(previews.creations[0].gift.name).toBe('Stolní hra Azul');
		expect(previews.deletions).toEqual(new Set(['g-lego']));
	});

	it('leaves out rows that can never apply', () => {
		expect(previewsOf(decide()).edits.has('g-shared')).toBe(false);
	});

	it('updates as single fields are rejected or edited', () => {
		const decisions = decide();

		decisions.actions.toggleField('r2', 'quantity', CHANGE_DECISION.rejected);
		const withoutQuantity = previewsOf(decisions).edits.get('g-duna');
		expect(withoutQuantity?.name).toBe('Kniha Duna (brožovaná)');
		expect(withoutQuantity).not.toHaveProperty('quantity');

		expect(decisions.actions.editField('r2', 'name', 'Duna, sběratelské vydání')).toBe(true);
		expect(previewsOf(decisions).edits.get('g-duna')?.name).toBe('Duna, sběratelské vydání');
	});

	it('drops a rejected new gift, a rejected edit and a kept gift from the preview', () => {
		const decisions = decide();

		decisions.actions.decideRow('r1', CHANGE_DECISION.rejected);
		decisions.actions.decideRow('r2', CHANGE_DECISION.rejected);
		decisions.actions.chooseRow('r3', false);

		const previews = previewsOf(decisions);
		expect(previews.creations).toEqual([]);
		expect(previews.edits.size).toBe(0);
		expect(previews.deletions.size).toBe(0);
	});

	it('keeps ghost gifts of different proposals apart and combines their edits of one gift', () => {
		const renamed = decide();
		const recounted = decide();
		renamed.actions.toggleField('r2', 'quantity', CHANGE_DECISION.rejected);
		recounted.actions.toggleField('r2', 'name', CHANGE_DECISION.rejected);

		const previews = previewsOf(renamed, recounted);

		expect(previews.edits.get('g-duna')).toEqual(
			expect.objectContaining({ name: 'Kniha Duna (brožovaná)', quantity: 2 }),
		);
		expect(new Set(previews.creations.map((creation) => creation.key)).size).toBe(2);
	});

	it('keeps previewing a proposal whose live and stored cards overlap until both are gone', () => {
		const registry: DecidingProposalRegistry = new SvelteSet();
		const storedCard = registration('proposal-1', decide());
		const liveCard = registration('proposal-1', decide());
		registry.add(storedCard);
		registry.add(liveCard);

		expect(giftLivePreviews(registry).creations).toHaveLength(1);

		registry.delete(liveCard);
		expect(giftLivePreviews(registry).creations).toHaveLength(1);

		registry.delete(storedCard);
		expect(giftLivePreviews(registry)).toBe(NO_GIFT_LIVE_PREVIEWS);
	});

	it('previews nothing while no proposal is being decided', () => {
		expect(giftLivePreviews(new SvelteSet())).toBe(NO_GIFT_LIVE_PREVIEWS);
	});
});

describe('previewedGift', () => {
	const previews = previewsOf(decide());

	it('shows a proposed edit on the stored gift and marks it', () => {
		const shown = previewedGift(storedGift({ id: 'g-duna', name: 'Kniha Duna' }), previews);

		expect(shown.livePreview).toBe(GIFT_LIVE_PREVIEW.edit);
		expect(shown.gift.name).toBe('Kniha Duna (brožovaná)');
		expect(shown.gift.id).toBe('g-duna');
	});

	it('marks a gift pending deletion without changing it', () => {
		const lego = storedGift({ id: 'g-lego', name: 'Lego Titanic' });

		expect(previewedGift(lego, previews)).toEqual({
			gift: lego,
			livePreview: GIFT_LIVE_PREVIEW.deletion,
		});
	});

	it('leaves gifts the proposals do not touch as they are', () => {
		const untouched = storedGift({ id: 'g-other' });

		expect(previewedGift(untouched, previews)).toEqual({
			gift: untouched,
			livePreview: undefined,
		});
	});
});
