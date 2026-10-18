<script lang="ts">
	import { untrack } from 'svelte';
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
		CHANGE_ROW_GROUP,
		initialChangeSelection,
		ordinarySelectionState,
		selectableChangeRowCount,
		selectedChangeRowIds,
		toggleOrdinarySelection,
		withChangeRowSelected,
	} from '$lib/modules/change_proposals/change_review_selection.js';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import ChangeReviewControls from './ChangeReviewControls.svelte';
	import ChangeReviewHeader from './ChangeReviewHeader.svelte';
	import ChangeReviewOutcomes from './ChangeReviewOutcomes.svelte';
	import ChangeReviewSections from './ChangeReviewSections.svelte';
	import ConfirmChangeList from './ConfirmChangeList.svelte';
	import ProposalApplyBar from './ProposalApplyBar.svelte';
	import ProposalSummary from './ProposalSummary.svelte';
	import ReviewActionDialog from './ReviewActionDialog.svelte';
	import { CHANGE_KIND_PRESENTATION } from './change_review_presentation.js';
	import {
		CHANGE_REVIEW_FILTER,
		buildReviewRowEntries,
		type ChangeReviewFilter,
	} from './change_review_rows.js';
	import { giftLabelLookups, type ChangeRowContext } from './change_row_model.js';

	type ReviewAction = 'apply' | 'undo' | 'discard';

	const CONFIRM_LEADS = {
		one: m.change_review_confirm_lead_one,
		few: m.change_review_confirm_lead_few,
		other: m.change_review_confirm_lead_other,
	};
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
	 * The submitter's review of one agent proposal: select rows, apply them as one batch, undo the
	 * batch or discard the proposal. The parent refreshes `proposal` after each action.
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
		onapply: (selectedRowIds: string[]) => Promise<ApplyChangeProposalResult>;
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

	let selection = $state.raw<ReadonlySet<string>>(
		untrack(() => initialChangeSelection(proposal.rows)),
	);
	let filter = $state<ChangeReviewFilter>(CHANGE_REVIEW_FILTER.all);
	let applyConflicts = $state.raw<ReadonlyMap<string, ChangeRowConflict[]>>(new Map());
	let applyErrors = $state.raw<ReadonlyMap<string, ChangeRowError>>(new Map());
	let undoChangedGifts = $state.raw<{ giftId: string; name: string | null }[]>([]);
	let pendingAction = $state<ReviewAction | null>(null);
	let focusOutcome = $state(false);
	let confirmOpen = $state(false);
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
			selection,
			filter,
			applyOutcomes: { conflicts: applyConflicts, errors: applyErrors },
			changedGiftIds: new Set(undoChangedGifts.map((gift) => gift.giftId)),
			context: rowContext,
			lookups: giftLabelLookups(rowContext, (category) =>
				labelForGiftCategory(category, getLocale()),
			),
		}),
	);
	const reviewRows = $derived(entries.map((entry) => entry.row));
	const selectedRowIds = $derived(selectedChangeRowIds(reviewRows, selection));
	const selectableCount = $derived(selectableChangeRowCount(reviewRows));
	const ordinaryState = $derived(ordinarySelectionState(reviewRows, selection));
	const confirmSelectedEntries = $derived(
		entries.filter((entry) => entry.group === CHANGE_ROW_GROUP.confirm && entry.selected),
	);
	const filterCounts = $derived({
		[CHANGE_REVIEW_FILTER.all]: entries.length,
		[CHANGE_REVIEW_FILTER.confirm]: entries.filter(
			(entry) => entry.group === CHANGE_ROW_GROUP.confirm,
		).length,
		[CHANGE_REVIEW_FILTER.conflicts]: entries.filter((entry) => entry.blocked).length,
	});
	const otherSelectedCount = $derived(selectedRowIds.length - confirmSelectedEntries.length);
	const undoGiftNames = $derived(
		undoChangedGifts.map((gift) => gift.name ?? m.change_review_unknown_gift()),
	);
	const appliedCount = $derived(
		proposal.rows.filter((row) => row.status === CHANGE_ROW_STATUS.applied).length,
	);

	function setRowSelected(rowId: string, selected: boolean) {
		selection = withChangeRowSelected(selection, rowId, selected);
	}

	function toggleAllOrdinary() {
		selection = toggleOrdinarySelection(reviewRows, selection);
	}

	function firstFailureMessage(rows: { error: ChangeRowError }[], fallback: string): string {
		const error = rows[0]?.error;
		return error === undefined
			? fallback
			: translateServerErrorCode(error.code, error.details, fallback);
	}

	function requestApply() {
		if (confirmSelectedEntries.length > 0) {
			confirmOpen = true;
		} else {
			void runApply();
		}
	}

	async function runApply() {
		pendingAction = 'apply';
		try {
			const result = await onapply(selectedRowIds);
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
			confirmOpen = false;
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

<div class="change-review" data-testid="change-review" data-state={proposal.state}>
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
		<ChangeReviewControls
			bind:filter
			allSelected={ordinaryState.checked}
			someSelected={ordinaryState.indeterminate}
			selectedCount={selectedRowIds.length}
			{selectableCount}
			{filterCounts}
			ontoggleall={toggleAllOrdinary}
		/>
	{/if}
	<ChangeReviewSections
		{entries}
		{interactive}
		{filter}
		busy={pendingAction === 'apply'}
		onselectedchange={setRowSelected}
	/>
	{#if interactive}
		<ProposalApplyBar
			selectedCount={selectedRowIds.length}
			{selectableCount}
			confirmSelectedCount={confirmSelectedEntries.length}
			pending={pendingAction === 'apply'}
			onapply={requestApply}
		/>
	{/if}
</div>

<ReviewActionDialog
	bind:open={confirmOpen}
	pending={pendingAction === 'apply'}
	title={m.change_review_confirm_title()}
	description={otherSelectedCount > 0
		? countCopy(CONFIRM_LEADS, otherSelectedCount)
		: m.change_review_confirm_lead_none()}
	cancelLabel={m.change_review_back_to_review()}
	confirmLabel={m.change_review_confirm_apply()}
	pendingLabel={m.change_review_applying()}
	confirmIntent="primary"
	testId="change-review-confirm-dialog"
	onconfirm={() => void runApply()}
>
	<ConfirmChangeList entries={confirmSelectedEntries} />
</ReviewActionDialog>

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
</style>
