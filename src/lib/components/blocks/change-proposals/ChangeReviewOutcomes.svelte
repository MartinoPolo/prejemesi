<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import CheckIcon from '@lucide/svelte/icons/check';
	import HourglassIcon from '@lucide/svelte/icons/hourglass';
	import InfoIcon from '@lucide/svelte/icons/info';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import { Button } from '$lib/components/base/button/index.js';
	import {
		CHANGE_PROPOSAL_STATE,
		CHANGE_ROW_STATUS,
		type ChangeProposalView,
	} from '$lib/modules/change_proposals/types.js';
	import {
		countCopy,
		formatChangeReviewDate,
		pluralCopy,
		formatChangeReviewDateTime,
	} from '$lib/modules/change_proposals/change_review_copy.js';
	import OutcomeAlert from './OutcomeAlert.svelte';

	const APPLIED_TITLES = {
		one: m.change_review_applied_title_one,
		few: m.change_review_applied_title_few,
		other: m.change_review_applied_title_other,
	};
	const APPLY_CONFLICT_TITLES = {
		one: m.change_review_apply_conflict_title_one,
		few: m.change_review_apply_conflict_title_few,
		other: m.change_review_apply_conflict_title_other,
	};

	let {
		proposal,
		applyConflictCount,
		applyFailed,
		undoChangedGiftNames,
		undoPending,
		focusOutcome,
		listHref,
		onundo,
	}: {
		proposal: ChangeProposalView;
		/** Rows the last Apply found changed; nothing applied. */
		applyConflictCount: number;
		/** The last Apply hit a rule failure; nothing applied. */
		applyFailed: boolean;
		/** Gifts changed since apply, which is why undo refused. */
		undoChangedGiftNames: readonly string[];
		undoPending: boolean;
		focusOutcome: boolean;
		listHref: string;
		onundo: () => void;
	} = $props();

	const appliedCount = $derived(
		proposal.rows.filter((row) => row.status === CHANGE_ROW_STATUS.applied).length,
	);
	const undoBlocked = $derived(undoChangedGiftNames.length > 0);
</script>

{#snippet openListAction()}
	<Button intent="secondary" href={listHref}>{m.change_review_open_list()}</Button>
{/snippet}

{#snippet appliedActions()}
	{#if proposal.undo?.available === true}
		<Button
			intent="danger"
			disabled={undoBlocked || undoPending}
			aria-describedby={undoBlocked ? 'change-review-undo-block' : undefined}
			onclick={onundo}
		>
			{#if undoPending}
				<LoaderIcon
					class="animate-spin"
					data-icon="inline-start"
				/>{m.change_review_undoing()}
			{:else}
				<Undo2Icon data-icon="inline-start" />{m.change_review_undo()}
			{/if}
		</Button>
	{/if}
	{@render openListAction()}
{/snippet}

{#if proposal.state === CHANGE_PROPOSAL_STATE.applied && proposal.appliedAt !== null}
	<OutcomeAlert
		tone="success"
		icon={CheckIcon}
		title={pluralCopy(APPLIED_TITLES, {
			count: appliedCount,
			date: formatChangeReviewDateTime(proposal.appliedAt),
		})}
		body={proposal.undo?.available === true
			? m.change_review_applied_body()
			: m.change_review_undo_unavailable()}
		focusOnMount={focusOutcome}
		testId="change-review-applied"
		actions={appliedActions}
	/>
	{#if undoBlocked}
		<OutcomeAlert
			tone="destructive"
			icon={TriangleAlertIcon}
			title={m.change_review_undo_conflict_title()}
			urgent
			testId="change-review-undo-conflict"
		>
			<p id="change-review-undo-block">{m.change_review_undo_conflict_body()}</p>
			<ul class="changed-gifts">
				{#each undoChangedGiftNames as name, index (index)}
					<li>{name}</li>
				{/each}
			</ul>
		</OutcomeAlert>
	{/if}
{:else if proposal.state === CHANGE_PROPOSAL_STATE.undone && proposal.undoneAt !== null}
	<OutcomeAlert
		tone="default"
		icon={Undo2Icon}
		title={m.change_review_undone_title({
			date: formatChangeReviewDateTime(proposal.undoneAt),
		})}
		body={m.change_review_undone_body()}
		focusOnMount={focusOutcome}
		testId="change-review-undone"
		actions={openListAction}
	/>
{:else if proposal.state === CHANGE_PROPOSAL_STATE.expired}
	<OutcomeAlert
		tone="warning"
		icon={HourglassIcon}
		title={m.change_review_expired_title({ date: formatChangeReviewDate(proposal.expiresAt) })}
		body={m.change_review_expired_body()}
		testId="change-review-expired"
	/>
{:else if proposal.state === CHANGE_PROPOSAL_STATE.discarded}
	<OutcomeAlert
		tone="default"
		icon={InfoIcon}
		title={m.change_review_discarded_title()}
		body={m.change_review_discarded_body()}
		focusOnMount={focusOutcome}
		testId="change-review-discarded"
	/>
{:else if applyConflictCount > 0}
	<OutcomeAlert
		tone="warning"
		icon={TriangleAlertIcon}
		title={countCopy(APPLY_CONFLICT_TITLES, applyConflictCount)}
		body={m.change_review_apply_conflict_body()}
		urgent
		testId="change-review-apply-conflict"
	/>
{:else if applyFailed}
	<OutcomeAlert
		tone="destructive"
		icon={BanIcon}
		title={m.change_review_apply_failed_title()}
		body={m.change_review_apply_failed_body()}
		urgent
		testId="change-review-apply-failed"
	/>
{/if}

<style>
	.changed-gifts {
		display: grid;
		gap: 2px;
		margin-top: var(--space-1);
		padding-left: 18px;
		list-style: disc;
	}
</style>
