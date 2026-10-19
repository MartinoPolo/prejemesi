<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import { toastError } from '$lib/components/base/toast/index.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import type { GiftByRole } from '$lib/modules/gifts/types.js';
	import {
		labelForGiftCategory,
		type PublicGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import {
		translateServerError,
		translateServerErrorCode,
	} from '$lib/modules/errors/translate_server_error.js';
	import {
		CHANGE_PROPOSAL_OUTCOME,
		CHANGE_PROPOSAL_STATE,
		CHANGE_ROW_STATUS,
		type ApplyChangeProposalResult,
		type ChangeProposalView,
		type ChangeRowConflict,
		type ChangeRowError,
		type UndoChangeProposalResult,
	} from '$lib/modules/change_proposals/types.js';
	import {
		CHANGE_DECISION,
		type ChangeDecision,
		type ChangeRowDecision,
	} from '$lib/modules/change_proposals/change_field_decisions.js';
	import {
		CHANGE_ROW_GROUP,
		appliedChangeReview,
		changeRowDecisions,
		fieldEditInput,
		fieldEditorText,
		includedRowCount,
		initialChangeReview,
		unresolvedChangeCount,
		withEveryRowDecided,
		withFieldDecisionToggled,
		withFieldEdited,
		withRowChoiceToggled,
		withRowDecided,
		type ChangeReview,
	} from '$lib/modules/change_proposals/change_review_decisions.js';
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
	import {
		CHANGE_REVIEW_FILTER,
		activeChangeReview,
		buildReviewRowEntries,
		type ChangeReviewActions,
		type ChangeReviewFilter,
	} from './change_review_rows.js';
	import { giftLabelLookups, type ChangeRowContext } from './change_row_model.js';

	type ReviewAction = 'apply' | 'undo' | 'discard';

	const UNDO_TITLES = {
		one: m.change_review_undo_title_one,
		few: m.change_review_undo_title_few,
		other: m.change_review_undo_title_other,
	};
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
	let review = $state.raw<ChangeReview>(untrack(() => initialChangeReview(proposal.rows)));
	let showUnresolved = $state(false);
	let announcement = $state('');
	let filter = $state<ChangeReviewFilter>(CHANGE_REVIEW_FILTER.all);
	let applyConflicts = $state.raw<ReadonlyMap<string, ChangeRowConflict[]>>(new Map());
	let applyErrors = $state.raw<ReadonlyMap<string, ChangeRowError>>(new Map());
	let undoChangedGifts = $state.raw<{ giftId: string; name: string | null }[]>([]);
	let pendingAction = $state<ReviewAction | null>(null);
	let focusOutcome = $state(false);
	let undoOpen = $state(false);
	let discardOpen = $state(false);

	const interactive = $derived(proposal.state === CHANGE_PROPOSAL_STATE.pending);
	const rowContext = $derived<ChangeRowContext>({
		currentGifts,
		categories,
		priorityLevels,
		submitterName: proposal.submitterName,
		kindTitle: (kind) => CHANGE_KIND_PRESENTATION[kind].title(),
	});
	const entries = $derived(
		buildReviewRowEntries({
			rows: proposal.rows,
			state: proposal.state,
			review: interactive ? review : appliedChangeReview(proposal.rows),
			filter,
			applyOutcomes: { conflicts: applyConflicts, errors: applyErrors },
			changedGiftIds: new Set(undoChangedGifts.map((gift) => gift.giftId)),
			context: rowContext,
			lookups: giftLabelLookups(rowContext, (category) =>
				labelForGiftCategory(category, getLocale()),
			),
		}),
	);
	const activeReview = $derived(activeChangeReview(entries));
	const decidableRows = $derived(
		entries.filter((entry) => entry.rowReview !== undefined).map((entry) => entry.row),
	);
	const unresolvedCount = $derived(unresolvedChangeCount(activeReview));
	const includedCount = $derived(includedRowCount(activeReview));
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

	const actions: ChangeReviewActions = {
		decideRow: (rowId, decision) => {
			review = withRowDecided(review, rowId, decision);
		},
		chooseRow: (rowId, accepted) => {
			review = withRowChoiceToggled(review, rowId, accepted);
		},
		toggleField: (rowId, field, decision) => {
			review = withFieldDecisionToggled(review, rowId, field, decision);
		},
		editField: (rowId, field, text) => {
			const row = proposal.rows.find((candidate) => candidate.rowId === rowId);
			if (row === undefined) {
				return false;
			}
			if (text.trim() === fieldEditorText(field, row.input).trim()) {
				review = withFieldEdited(review, rowId, field, null);
				return true;
			}
			const edited = fieldEditInput(field, text, row.input);
			if (edited === null) {
				return false;
			}
			review = withFieldEdited(review, rowId, field, edited);
			return true;
		},
	};

	function decideEveryRow(decision: ChangeDecision) {
		review = withEveryRowDecided(review, decidableRows, decision);
	}

	function firstFailureMessage(rows: { error: ChangeRowError }[], fallback: string): string {
		const error = rows[0]?.error;
		return error === undefined
			? fallback
			: translateServerErrorCode(error.code, error.details, fallback);
	}

	/** Outlines every open decision, reads out how many are left and moves focus to the first. */
	async function revealUnresolved() {
		showUnresolved = true;
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
			const result = await onapply(changeRowDecisions(proposal.rows, activeReview));
			if (result.outcome === CHANGE_PROPOSAL_OUTCOME.conflict) {
				applyConflicts = new Map(result.rows.map((row) => [row.rowId, row.conflicts]));
				applyErrors = new Map();
			} else if (result.outcome === CHANGE_PROPOSAL_OUTCOME.failed) {
				applyErrors = new Map(result.rows.map((row) => [row.rowId, row.error]));
				applyConflicts = new Map();
			} else {
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
		applyConflictCount={applyConflicts.size}
		applyFailed={applyErrors.size > 0}
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
		actions={interactive ? actions : undefined}
		{showUnresolved}
	/>
	{#if interactive}
		<ProposalApplyBar
			{includedCount}
			{unresolvedCount}
			{showUnresolved}
			{announcement}
			pending={pendingAction === 'apply'}
			onrejectall={() => decideEveryRow(CHANGE_DECISION.rejected)}
			onacceptall={() => decideEveryRow(CHANGE_DECISION.accepted)}
			onapply={requestApply}
		/>
	{/if}
</div>

<ReviewActionDialog
	bind:open={undoOpen}
	pending={pendingAction === 'undo'}
	title={countCopy(UNDO_TITLES, appliedCount)}
	description={m.change_review_undo_body()}
	cancelLabel={m.change_review_back_short()}
	confirmLabel={m.change_review_undo()}
	pendingLabel={m.change_review_undoing()}
	confirmIntent="danger"
	confirmIcon={Undo2Icon}
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
