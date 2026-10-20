<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';
	import { toastError } from '$lib/components/base/toast/index.js';
	import ChangeKindTitle from '$lib/components/blocks/change-proposals/ChangeKindTitle.svelte';
	import ChangeRowDetails from '$lib/components/blocks/change-proposals/ChangeRowDetails.svelte';
	import UndoProposalDialog from '$lib/components/blocks/change-proposals/UndoProposalDialog.svelte';
	import RowDecision from '$lib/components/blocks/change-proposals/RowDecision.svelte';
	import { CHANGE_KIND_PRESENTATION } from '$lib/components/blocks/change-proposals/change_review_presentation.js';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import { ProposalDecisions } from '$lib/components/blocks/change-proposals/proposal_decisions.svelte.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import type { StateRaw } from '$lib/reactivity/state.svelte.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import {
		applyChangeProposal,
		discardChangeProposal,
		undoChangeProposal,
	} from '$lib/modules/change_proposals/index.js';
	import {
		CHANGE_PROPOSAL_OUTCOME,
		CHANGE_PROPOSAL_STATE,
		CHANGE_ROW_STATUS,
		type ChangeProposalView,
	} from '$lib/modules/change_proposals/types.js';
	import {
		countCopy,
		formatChangeReviewDateTime,
	} from '$lib/modules/change_proposals/change_review_copy.js';
	import ProposalDecisionControls from './ProposalDecisionControls.svelte';
	import {
		APPLIED_TITLES,
		INLINE_CHECK_MAX_ROWS,
		PROPOSAL_TITLES,
		type DecisionBarControls,
	} from './chat_presentation.js';

	type CardAction = 'apply' | 'discard' | 'undo';

	const APPLY_CONFLICT_TITLES = {
		one: m.change_review_apply_conflict_title_one,
		few: m.change_review_apply_conflict_title_few,
		other: m.change_review_apply_conflict_title_other,
	};

	/**
	 * A proposal the assistant made, decided in the chat through the same path as the review page.
	 * The newest pending one hands its controls to the decision bar above the composer.
	 */
	let {
		proposal,
		rowContext,
		inBar,
		decisionBar,
	}: {
		proposal: ChangeProposalView;
		rowContext: Omit<ChangeRowContext, 'submitterName' | 'kindTitle'>;
		/** The decision bar shows this proposal's controls instead of the card. */
		inBar: boolean;
		decisionBar: StateRaw<DecisionBarControls | null>;
	} = $props();

	let card = $state<HTMLElement>();
	let inspecting = $state(false);
	let pendingAction = $state<CardAction | null>(null);
	let undoOpen = $state(false);

	const decisions = new ProposalDecisions({
		proposal: () => proposal,
		context: () => ({
			...rowContext,
			submitterName: proposal.submitterName,
			kindTitle: (kind) => CHANGE_KIND_PRESENTATION[kind].title(),
		}),
	});
	const titleId = $derived(`chat-proposal-${proposal.id}`);
	const reviewHref = $derived(
		proposal.wishlistShortId === null
			? null
			: localizeInternalHref(
					resolve('/(app)/w/[id]/changes/[proposalId]', {
						id: proposal.wishlistShortId,
						proposalId: proposal.id,
					}),
				),
	);
	const checksInline = $derived(proposal.rowCount <= INLINE_CHECK_MAX_ROWS);
	const appliedCount = $derived(
		proposal.rows.filter((row) => row.status === CHANGE_ROW_STATUS.applied).length,
	);
	const canUndo = $derived(proposal.undo?.available === true);

	function locate() {
		card?.scrollIntoView({
			block: 'nearest',
			behavior: prefersReducedMotion.current ? 'auto' : 'smooth',
		});
	}

	/** Opens the check where it can and moves focus to the first open decision. */
	async function revealUnresolved() {
		decisions.showUnresolved = true;
		if (!checksInline) {
			return;
		}
		inspecting = true;
		await tick();
		const first = card?.querySelector('.needs-decision');
		first?.scrollIntoView({
			block: 'center',
			behavior: prefersReducedMotion.current ? 'auto' : 'smooth',
		});
		first?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({
			preventScroll: true,
		});
	}

	async function run(action: CardAction, work: () => Promise<void>, fallback: string) {
		pendingAction = action;
		try {
			await work();
		} catch (error) {
			toastError(translateServerError(error, fallback));
		} finally {
			pendingAction = null;
		}
	}

	async function apply() {
		const result = await applyChangeProposal({
			proposalId: proposal.id,
			decisions: decisions.decisions(),
		});
		if (decisions.recordApplyResult(result)) {
			return;
		}
		inspecting = checksInline;
		toastError(
			result.outcome === CHANGE_PROPOSAL_OUTCOME.conflict
				? countCopy(APPLY_CONFLICT_TITLES, result.rows.length)
				: m.change_review_apply_failed_title(),
		);
	}

	function requestApply() {
		if (decisions.unresolvedCount > 0) {
			void revealUnresolved();
		} else if (decisions.includedCount === 0) {
			void run(
				'discard',
				async () => {
					await discardChangeProposal({ proposalId: proposal.id });
				},
				m.change_review_discard_error(),
			);
		} else {
			void run('apply', apply, m.change_review_apply_error());
		}
	}

	async function undo() {
		const result = await undoChangeProposal({ proposalId: proposal.id });
		if (result.outcome === CHANGE_PROPOSAL_OUTCOME.conflict) {
			toastError(m.change_review_undo_conflict_title());
		} else if (result.outcome === CHANGE_PROPOSAL_OUTCOME.failed) {
			toastError(m.change_review_undo_error());
		}
	}

	// The live turn's copy of a card and its stored copy overlap for a moment, so a card claims
	// the free bar whenever it is released rather than only once on mount.
	const barControlsHandle: DecisionBarControls = { render: barControls };
	const ownsBar = $derived(inBar && decisions.interactive);

	$effect(() => {
		if (ownsBar && decisionBar.current === null) {
			decisionBar.current = barControlsHandle;
		}
	});

	$effect(() => {
		if (!ownsBar) {
			return;
		}
		return () => {
			if (untrack(() => decisionBar.current) === barControlsHandle) {
				decisionBar.current = null;
			}
		};
	});
</script>

{#snippet controls(onlocate?: () => void)}
	<ProposalDecisionControls
		{decisions}
		rowCount={proposal.rowCount}
		{inspecting}
		reviewHref={checksInline ? null : reviewHref}
		pending={pendingAction !== null}
		oninspect={() => (inspecting = !inspecting)}
		onapply={requestApply}
		{onlocate}
	/>
{/snippet}

{#snippet barControls()}
	{@render controls(locate)}
{/snippet}

{#snippet summaryRows()}
	<ul class="summary-rows">
		{#each decisions.entries as entry (entry.row.rowId)}
			<li class="summary-row">
				<ChangeKindTitle kind={entry.row.kind} />
				<span class="summary-name">{entry.model.identity.name}</span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet inspectRows()}
	<ul class="inspect-rows">
		{#each decisions.entries as entry (entry.row.rowId)}
			{@const consequenceId = `chat-consequence-${entry.row.rowId}`}
			<li class="inspect-row" data-testid="chat-proposal-row">
				<div class="inspect-head">
					<span class="inspect-title">
						<ChangeKindTitle kind={entry.row.kind} />
						<span class="summary-name">{entry.model.identity.name}</span>
					</span>
					<RowDecision
						{entry}
						actions={decisions.actions}
						showUnresolved={decisions.showUnresolved}
						describedBy={entry.model.consequence === null ? undefined : consequenceId}
					/>
				</div>
				<ChangeRowDetails
					{entry}
					{consequenceId}
					reasonTone={entry.row.status === CHANGE_ROW_STATUS.conflict
						? 'warning'
						: 'danger'}
					actions={decisions.actions}
					showUnresolved={decisions.showUnresolved}
					showCurrentCards={false}
				/>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet appliedState()}
	<div class="band" data-tone="success">
		<h3 class="title" id={titleId}>
			<CheckIcon aria-hidden="true" />{countCopy(APPLIED_TITLES, appliedCount)}
		</h3>
	</div>
	<div class="body">
		{@render summaryRows()}
		{#if canUndo}
			<div>
				<Button
					intent="danger"
					size="sm"
					disabled={pendingAction !== null}
					data-testid="chat-proposal-undo"
					onclick={() => (undoOpen = true)}
				>
					<Undo2Icon data-icon="inline-start" />{m.chat_undo()}
				</Button>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet pendingState()}
	<div class="band">
		<h3 class="title" id={titleId}>
			<ClipboardListIcon aria-hidden="true" />{countCopy(PROPOSAL_TITLES, proposal.rowCount)}
		</h3>
	</div>
	<div class="body">
		{#if inspecting && checksInline}
			{@render inspectRows()}
		{:else}
			{@render summaryRows()}
		{/if}
		{#if !inBar}
			{@render controls()}
		{/if}
		<p class="meta">
			<span class="meta-item">
				<ClockIcon aria-hidden="true" />
				{m.chat_proposal_expires({
					date: formatChangeReviewDateTime(proposal.expiresAt),
				})}
			</span>
			{#if checksInline && reviewHref !== null}
				<a class="meta-link" href={reviewHref}>{m.chat_review_page()}</a>
			{/if}
		</p>
	</div>
{/snippet}

{#snippet closedState()}
	<div class="band is-closed">
		<h3 class="title" id={titleId}>
			{#if proposal.state === CHANGE_PROPOSAL_STATE.undone}
				<Undo2Icon aria-hidden="true" />{m.chat_undone_title()}
			{:else if proposal.state === CHANGE_PROPOSAL_STATE.expired}
				<ClockIcon aria-hidden="true" />{m.chat_expired_title()}
			{:else}
				<XIcon aria-hidden="true" />{m.chat_declined_title()}
			{/if}
		</h3>
		<span class="meta">{m.chat_closed_note()}</span>
	</div>
{/snippet}

<article
	class="card"
	data-state={proposal.state}
	data-testid="chat-proposal"
	aria-labelledby={titleId}
	bind:this={card}
>
	{#if proposal.state === CHANGE_PROPOSAL_STATE.applied}
		{@render appliedState()}
	{:else if proposal.state === CHANGE_PROPOSAL_STATE.pending}
		{@render pendingState()}
	{:else}
		{@render closedState()}
	{/if}
</article>

<UndoProposalDialog
	bind:open={undoOpen}
	pending={pendingAction === 'undo'}
	{appliedCount}
	confirmLabel={m.chat_undo()}
	testId="chat-proposal-undo-dialog"
	onconfirm={() =>
		void run('undo', undo, m.change_review_undo_error()).finally(() => (undoOpen = false))}
/>

<style>
	/* Nested in the 16px panel with a 2px border and a 12px inset: 16 - 2 - 2 = 12px corners. */
	.card {
		overflow: hidden;
		border: 2px solid var(--ink);
		border-radius: var(--chat-surface-radius);
		background: var(--card);
	}

	.band {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 2px solid var(--ink);
		background: var(--tint);
	}

	.band[data-tone='success'] {
		background: color-mix(in oklab, var(--status-success) 18%, var(--card));
	}

	.band.is-closed {
		border-bottom: 0;
		background: var(--card);
	}

	.title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-md);
		font-weight: 700;
	}

	.title :global(svg),
	.meta-item :global(svg) {
		flex: none;
		width: 16px;
		height: 16px;
	}

	.body {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3);
	}

	.summary-rows,
	.inspect-rows {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.summary-row,
	.inspect-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px var(--space-2);
		min-width: 0;
		font-size: var(--text-md);
	}

	.summary-name {
		min-width: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.inspect-row {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}

	.inspect-row:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.inspect-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px var(--space-3);
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.meta-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.meta-link {
		color: var(--brand-link);
		font-weight: 600;
		text-decoration: underline;
	}

	/* After a blocked Použít, every open decision's controls carry a danger outline. */
	.card :global(.needs-decision) {
		outline: 2px solid var(--status-danger-text);
		outline-offset: 2px;
	}
</style>
