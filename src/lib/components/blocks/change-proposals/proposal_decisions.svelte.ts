import { getLocale } from '$lib/paraglide/runtime.js';
import { labelForGiftCategory } from '$lib/modules/gift-categories/types.js';
import {
	CHANGE_PROPOSAL_OUTCOME,
	CHANGE_PROPOSAL_STATE,
	type ApplyChangeProposalResult,
	type ChangeProposalView,
} from '$lib/modules/change_proposals/types.js';
import type {
	ChangeDecision,
	ChangeRowDecision,
} from '$lib/modules/change_proposals/change_field_decisions.js';
import {
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
import {
	CHANGE_REVIEW_FILTER,
	NO_APPLY_ROW_OUTCOMES,
	activeChangeReview,
	applyRowOutcomes,
	buildReviewRowEntries,
	type ApplyRowOutcomes,
	type ChangeReviewActions,
	type ChangeReviewFilter,
} from './change_review_rows.js';
import { giftLabelLookups, type ChangeRowContext } from './change_row_model.js';

export interface ProposalDecisionsSource {
	proposal: () => ChangeProposalView;
	context: () => ChangeRowContext;
	filter?: () => ChangeReviewFilter;
	/** Gifts that changed since apply, which is why undo refused. */
	changedGiftIds?: () => ReadonlySet<string>;
}

const NO_GIFT_IDS: ReadonlySet<string> = new Set();

/**
 * The reviewer's decisions on one proposal and what the last Apply reported, shared by the review
 * page and the chat so both decide, count and apply the same way.
 */
export class ProposalDecisions {
	#source: ProposalDecisionsSource;
	review = $state.raw<ChangeReview>({});
	applyOutcomes = $state.raw<ApplyRowOutcomes>(NO_APPLY_ROW_OUTCOMES);
	/** Apply was pressed while decisions were open. */
	showUnresolved = $state(false);

	readonly interactive = $derived(this.#proposal().state === CHANGE_PROPOSAL_STATE.pending);
	readonly entries = $derived.by(() => {
		const proposal = this.#proposal();
		const context = this.#source.context();
		return buildReviewRowEntries({
			rows: proposal.rows,
			state: proposal.state,
			review: this.interactive ? this.review : appliedChangeReview(proposal.rows),
			filter: this.#source.filter?.() ?? CHANGE_REVIEW_FILTER.all,
			applyOutcomes: this.applyOutcomes,
			changedGiftIds: this.#source.changedGiftIds?.() ?? NO_GIFT_IDS,
			context,
			lookups: giftLabelLookups(context, (category) =>
				labelForGiftCategory(category, getLocale()),
			),
		});
	});
	readonly activeReview = $derived(activeChangeReview(this.entries));
	readonly unresolvedCount = $derived(unresolvedChangeCount(this.activeReview));
	readonly includedCount = $derived(includedRowCount(this.activeReview));

	readonly actions: ChangeReviewActions = {
		decideRow: (rowId, decision) => {
			this.review = withRowDecided(this.review, rowId, decision);
		},
		chooseRow: (rowId, accepted) => {
			this.review = withRowChoiceToggled(this.review, rowId, accepted);
		},
		toggleField: (rowId, field, decision) => {
			this.review = withFieldDecisionToggled(this.review, rowId, field, decision);
		},
		editField: (rowId, field, text) => {
			const row = this.#proposal().rows.find((candidate) => candidate.rowId === rowId);
			if (row === undefined) {
				return false;
			}
			if (text.trim() === fieldEditorText(field, row.input).trim()) {
				this.review = withFieldEdited(this.review, rowId, field, null);
				return true;
			}
			const edited = fieldEditInput(field, text, row.input);
			if (edited === null) {
				return false;
			}
			this.review = withFieldEdited(this.review, rowId, field, edited);
			return true;
		},
	};

	constructor(source: ProposalDecisionsSource) {
		this.#source = source;
		this.review = initialChangeReview(source.proposal().rows);
	}

	#proposal(): ChangeProposalView {
		return this.#source.proposal();
	}

	decideEveryRow(decision: ChangeDecision): void {
		const decidableRows = this.entries
			.filter((entry) => entry.rowReview !== undefined)
			.map((entry) => entry.row);
		this.review = withEveryRowDecided(this.review, decidableRows, decision);
	}

	decisions(): ChangeRowDecision[] {
		return changeRowDecisions(this.#proposal().rows, this.activeReview);
	}

	/** Keeps the rows that stopped the apply; true when the batch applied. */
	recordApplyResult(result: ApplyChangeProposalResult): boolean {
		this.applyOutcomes = applyRowOutcomes(result);
		return result.outcome === CHANGE_PROPOSAL_OUTCOME.applied;
	}
}
