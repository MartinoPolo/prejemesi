<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import { countCopy } from '$lib/modules/change_proposals/change_review_copy.js';
	import ReviewActionDialog from './ReviewActionDialog.svelte';

	const UNDO_TITLES = {
		one: m.change_review_undo_title_one,
		few: m.change_review_undo_title_few,
		other: m.change_review_undo_title_other,
	};

	/** Confirms undoing an applied proposal, from the review page or the chat. */
	let {
		open = $bindable(false),
		pending,
		appliedCount,
		confirmLabel,
		testId,
		onconfirm,
	}: {
		open?: boolean;
		pending: boolean;
		appliedCount: number;
		confirmLabel: string;
		testId: string;
		onconfirm: () => void;
	} = $props();
</script>

<ReviewActionDialog
	bind:open
	{pending}
	title={countCopy(UNDO_TITLES, appliedCount)}
	description={m.change_review_undo_body()}
	cancelLabel={m.change_review_back_short()}
	{confirmLabel}
	pendingLabel={m.change_review_undoing()}
	confirmIntent="danger"
	confirmIcon={Undo2Icon}
	{testId}
	{onconfirm}
/>
