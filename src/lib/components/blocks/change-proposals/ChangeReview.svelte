<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import * as m from '$lib/paraglide/messages.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toastError } from '$lib/components/base/toast/index.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
	import {
		translateServerError,
		translateServerErrorCode,
	} from '$lib/modules/errors/translate_server_error.js';
	import {
		CHANGE_PROPOSAL_OUTCOME,
		CHANGE_ROW_STATUS,
		type ApplyChangeProposalResult,
		type ChangeProposalView,
		type ChangeRowError,
		type UndoChangeProposalResult,
	} from '$lib/modules/change_proposals/types.js';
	import {
		CHANGE_DECISION,
		type ChangeRowDecision,
	} from '$lib/modules/change_proposals/change_field_decisions.js';
	import { CHANGE_ROW_GROUP } from '$lib/modules/change_proposals/change_review_decisions.js';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import ChangeReviewControls from './ChangeReviewControls.svelte';
	import ChangeReviewHeader from './ChangeReviewHeader.svelte';
	import ChangeReviewOutcomes from './ChangeReviewOutcomes.svelte';
	import ChangeReviewSections from './ChangeReviewSections.svelte';
	import ProposalApplyBar from './ProposalApplyBar.svelte';
	import ProposalSummary from './ProposalSummary.svelte';
	import ReviewActionDialog from './ReviewActionDialog.svelte';
	import {
		CHANGE_KIND_PRESENTATION,
		UNRESOLVED_DECISION_MESSAGES,
	} from './change_review_presentation.js';
	import { CHANGE_REVIEW_FILTER, type ChangeReviewFilter } from './change_review_rows.js';
	import { ProposalDecisions } from './proposal_decisions.svelte.js';
	import UndoProposalDialog from './UndoProposalDialog.svelte';

	type ReviewAction = 'apply' | 'undo' | 'discard';

	const DISCARD_BODIES = {
		one: m.change_review_discard_body_one,
		few: m.change_review_discard_body_few,
		other: m.change_review_discard_body_other,
	};

	/**
	 * The submitter's review of one agent proposal: decide each change or field, apply the accepted
	 * ones as one batch, undo the batch or discard the proposal. The parent refreshes `proposal`
	 * after each action.
	 */
	let {
		proposal,
		wishlistTitle,
		recipientName,
		listHref,
		currentGifts,
		categories,
		priorityLevels,
		now = new Date(),
		onapply,
		onundo,
		ondiscard,
	}: {
		proposal: ChangeProposalView;
		wishlistTitle: string;
		recipientName: string;
		listHref: string;
		currentGifts: readonly GiftByRole[];
		categories: readonly PublicGiftCategory[];
		priorityLevels: readonly { id: string; label: string }[];
		now?: Date;
		onapply: (decisions: ChangeRowDecision[]) => Promise<ApplyChangeProposalResult>;
		onundo: () => Promise<UndoChangeProposalResult>;
		ondiscard: () => Promise<void>;
	} = $props();

	untrack(() =>
		setGiftsContext(
			() => 'change-review',
			() => [...currentGifts],
			() => 'recipient',
			() => false,
			() => true,
			() => [],
		),
	);

	let root = $state<HTMLDivElement>();
	let announcement = $state('');
	let filter = $state<ChangeReviewFilter>(CHANGE_REVIEW_FILTER.all);
	let undoChangedGifts = $state.raw<{ giftId: string; name: string | null }[]>([]);
	let pendingAction = $state<ReviewAction | null>(null);
	let focusOutcome = $state(false);
	let undoOpen = $state(false);
	let discardOpen = $state(false);

	const decisions = new ProposalDecisions({
		proposal: () => proposal,
		context: () => ({
			currentGifts,
			categories,
			priorityLevels,
			submitterName: proposal.submitterName,
			kindTitle: (kind) => CHANGE_KIND_PRESENTATION[kind].title(),
		}),
		filter: () => filter,
		changedGiftIds: () => new Set(undoChangedGifts.map((gift) => gift.giftId)),
	});
	const { interactive, entries, unresolvedCount, includedCount } = $derived(decisions);
	const filterCounts = $derived({
		[CHANGE_REVIEW_FILTER.all]: entries.length,
		[CHANGE_REVIEW_FILTER.confirm]: entries.filter(
			(entry) => entry.group === CHANGE_ROW_GROUP.confirm,
		).length,
		[CHANGE_REVIEW_FILTER.conflicts]: entries.filter((entry) => entry.blocked).length,
	});
	const undoGiftNames = $derived(
		undoChangedGifts.map((gift) => gift.name ?? m.change_review_unknown_gift()),
	);
	const appliedCount = $derived(
		proposal.rows.filter((row) => row.status === CHANGE_ROW_STATUS.applied).length,
	);

	function firstFailureMessage(rows: { error: ChangeRowError }[], fallback: string): string {
		const error = rows[0]?.error;
		return error === undefined
			? fallback
			: translateServerErrorCode(error.code, error.details, fallback);
	}

	/** Outlines every open decision, reads out how many are left and moves focus to the first. */
	async function revealUnresolved() {
		decisions.showUnresolved = true;
		filter = CHANGE_REVIEW_FILTER.all;
		announcement = '';
		const message = countCopy(UNRESOLVED_DECISION_MESSAGES, unresolvedCount);
		requestAnimationFrame(() => (announcement = message));
		await tick();
		const first = root?.querySelector('.needs-decision');
		first?.closest('tr')?.scrollIntoView({
			block: 'center',
			behavior: prefersReducedMotion.current ? 'auto' : 'smooth',
		});
		first?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({
			preventScroll: true,
		});
	}

	function requestApply() {
		if (unresolvedCount > 0) {
			void revealUnresolved();
		} else if (includedCount === 0) {
			discardOpen = true;
		} else {
			void runApply();
		}
	}

	async function runApply() {
		pendingAction = 'apply';
		try {
			if (decisions.recordApplyResult(await onapply(decisions.decisions()))) {
				focusOutcome = true;
			}
		} catch (error) {
			toastError(translateServerError(error, m.change_review_apply_error()));
		} finally {
			pendingAction = null;
		}
	}

	async function runUndo() {
		pendingAction = 'undo';
		try {
			const result = await onundo();
			if (result.outcome === CHANGE_PROPOSAL_OUTCOME.conflict) {
				undoChangedGifts = result.changedGifts;
			} else if (result.outcome === CHANGE_PROPOSAL_OUTCOME.failed) {
				toastError(firstFailureMessage(result.rows, m.change_review_undo_error()));
			} else {
				focusOutcome = true;
			}
		} catch (error) {
			toastError(translateServerError(error, m.change_review_undo_error()));
		} finally {
			pendingAction = null;
			undoOpen = false;
		}
	}

	async function runDiscard() {
		pendingAction = 'discard';
		try {
			await ondiscard();
			focusOutcome = true;
		} catch (error) {
			toastError(translateServerError(error, m.change_review_discard_error()));
		} finally {
			pendingAction = null;
			discardOpen = false;
		}
	}
</script>

<div class="change-review" data-testid="change-review" data-state={proposal.state} bind:this={root}>
	<ChangeReviewHeader
		{listHref}
		{wishlistTitle}
		{recipientName}
		ondiscard={interactive ? () => (discardOpen = true) : undefined}
	/>
	<ProposalSummary {proposal} {now} />
	<ChangeReviewOutcomes
		{proposal}
		applyConflictCount={decisions.applyOutcomes.conflicts.size}
		applyFailed={decisions.applyOutcomes.errors.size > 0}
		undoChangedGiftNames={undoGiftNames}
		undoPending={pendingAction === 'undo'}
		{focusOutcome}
		{listHref}
		onundo={() => (undoOpen = true)}
	/>
	{#if interactive}
		<ChangeReviewControls bind:filter {filterCounts} />
	{/if}
	<ChangeReviewSections
		{entries}
		{interactive}
		{filter}
		busy={pendingAction === 'apply'}
		actions={interactive ? decisions.actions : undefined}
		showUnresolved={decisions.showUnresolved}
	/>
	{#if interactive}
		<ProposalApplyBar
			{includedCount}
			{unresolvedCount}
			showUnresolved={decisions.showUnresolved}
			{announcement}
			pending={pendingAction === 'apply'}
			onrejectall={() => decisions.decideEveryRow(CHANGE_DECISION.rejected)}
			onacceptall={() => decisions.decideEveryRow(CHANGE_DECISION.accepted)}
			onapply={requestApply}
		/>
	{/if}
</div>

<UndoProposalDialog
	bind:open={undoOpen}
	pending={pendingAction === 'undo'}
	{appliedCount}
	confirmLabel={m.change_review_undo()}
	testId="change-review-undo-dialog"
	onconfirm={() => void runUndo()}
/>

<ReviewActionDialog
	bind:open={discardOpen}
	pending={pendingAction === 'discard'}
	title={m.change_review_discard_title()}
	description={countCopy(DISCARD_BODIES, proposal.rowCount)}
	cancelLabel={m.change_review_back_to_review()}
	confirmLabel={m.change_review_discard()}
	pendingLabel={m.change_review_discarding()}
	confirmIntent="primary-destructive"
	confirmIcon={Trash2Icon}
	testId="change-review-discard-dialog"
	onconfirm={() => void runDiscard()}
/>

<style>
	.change-review {
		container: change-review / inline-size;
	}

	/* After a blocked Použít, every open decision's controls carry a danger outline. */
	.change-review :global(.needs-decision) {
		outline: 2px solid var(--status-danger-text);
		outline-offset: 2px;
	}
</style>
