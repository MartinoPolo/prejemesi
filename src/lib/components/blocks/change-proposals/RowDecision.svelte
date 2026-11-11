<script lang="ts">
	import type { Component } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { CHANGE_KIND } from '$lib/modules/change_proposals/types.js';
	import { CHANGE_DECISION } from '$lib/modules/change_proposals/change_field_decisions.js';
	import {
		ROW_REVIEW_KIND,
		wholeGiftPressed,
	} from '$lib/modules/change_proposals/change_review_decisions.js';
	import { CHANGE_KIND_PRESENTATION } from './change_review_presentation.js';
	import DecisionToggle from './DecisionToggle.svelte';
	import type { ChangeReviewActions, ReviewRowEntry } from './change_review_rows.js';
	import { RESERVATION_OPERATION } from './change_row_model.js';

	const CHOICE_TONE = {
		accept: 'accept',
		reject: 'reject',
		danger: 'danger',
	} as const;

	type ChoiceTone = (typeof CHOICE_TONE)[keyof typeof CHOICE_TONE];

	interface Choice {
		label: () => string;
		tone: ChoiceTone;
		icon: Component;
	}

	const ACCEPT_CHOICES: [Choice, Choice] = [
		{ label: m.change_review_accept, tone: CHOICE_TONE.accept, icon: CheckIcon },
		{ label: m.change_review_reject, tone: CHOICE_TONE.reject, icon: XIcon },
	];
	const DELETE_CHOICES: [Choice, Choice] = [
		{ label: m.change_review_choice_delete, tone: CHOICE_TONE.danger, icon: Trash2Icon },
		{ label: m.change_review_choice_keep, tone: CHOICE_TONE.reject, icon: XIcon },
	];
	const RESERVE_CHOICES: [Choice, Choice] = [
		{ label: m.change_review_choice_reserve, tone: CHOICE_TONE.accept, icon: CheckIcon },
		{ label: m.change_review_choice_not_reserve, tone: CHOICE_TONE.reject, icon: XIcon },
	];
	const INVITE_CHOICES: [Choice, Choice] = [
		{ label: m.change_review_choice_invite, tone: CHOICE_TONE.accept, icon: CheckIcon },
		{ label: m.change_review_choice_not_invite, tone: CHOICE_TONE.reject, icon: XIcon },
	];

	/**
	 * The header band's decision: Přijmout vše and Zamítnout vše over a gift's fields, or the row's
	 * own two choices, where pressing the active one leaves the row undecided again.
	 */
	let {
		entry,
		actions,
		showUnresolved,
		describedBy,
	}: {
		entry: ReviewRowEntry;
		actions: ChangeReviewActions;
		showUnresolved: boolean;
		describedBy: string | undefined;
	} = $props();

	const rowId = $derived(entry.row.rowId);
	const name = $derived(entry.model.identity.name);
	const choices = $derived.by(() => {
		if (entry.row.kind === CHANGE_KIND.giftDeletion) {
			return DELETE_CHOICES;
		}
		if (entry.row.kind === CHANGE_KIND.managerInvitation) {
			return INVITE_CHOICES;
		}
		return entry.row.operation === RESERVATION_OPERATION.reserve
			? RESERVE_CHOICES
			: ACCEPT_CHOICES;
	});
</script>

{#snippet decideButton(
	choice: Choice,
	pressed: 'true' | 'mixed' | 'false',
	action: string,
	onclick: () => void,
	compactOnPhone = false,
)}
	<DecisionToggle
		tone={choice.tone}
		icon={choice.icon}
		label={choice.label()}
		{pressed}
		{compactOnPhone}
		data-row-action={action}
		{onclick}
	/>
{/snippet}

{#if entry.rowReview?.kind === ROW_REVIEW_KIND.fields}
	<span
		class="decide-all"
		data-kind="bulk"
		role="group"
		aria-label={m.change_review_whole_gift_label({ name })}
	>
		{@render decideButton(
			{ label: m.change_review_accept_all, tone: CHOICE_TONE.accept, icon: CheckIcon },
			wholeGiftPressed(entry.rowReview, CHANGE_DECISION.accepted),
			'accept-all',
			() => actions.decideRow(rowId, CHANGE_DECISION.accepted),
			true,
		)}
		{@render decideButton(
			{ label: m.change_review_reject_all, tone: CHOICE_TONE.reject, icon: XIcon },
			wholeGiftPressed(entry.rowReview, CHANGE_DECISION.rejected),
			'reject-all',
			() => actions.decideRow(rowId, CHANGE_DECISION.rejected),
			true,
		)}
	</span>
{:else if entry.rowReview?.kind === ROW_REVIEW_KIND.whole}
	{@const accepted = entry.rowReview.accepted}
	<span
		class={['decide-all', showUnresolved && accepted === null && 'needs-decision']}
		data-kind="choice"
		role="group"
		aria-label={m.change_review_row_decision_label({
			kind: CHANGE_KIND_PRESENTATION[entry.row.kind].title(),
			name,
		})}
		aria-describedby={describedBy}
	>
		{@render decideButton(choices[0], accepted === true ? 'true' : 'false', 'choose-yes', () =>
			actions.chooseRow(rowId, true),
		)}
		{@render decideButton(choices[1], accepted === false ? 'true' : 'false', 'choose-no', () =>
			actions.chooseRow(rowId, false),
		)}
	</span>
{/if}

<style>
	.decide-all {
		display: flex;
		gap: var(--space-1);
		border-radius: var(--radius-btn);
	}
</style>
