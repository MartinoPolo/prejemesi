<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';
	import type { ProposalAction } from './change_review_presentation.js';

	/** Použít's label, shared by the review page and the chat: in flight, declining or the count. */
	let {
		pendingAction,
		declines,
		includedCount,
	}: {
		pendingAction: ProposalAction | null;
		/** Nothing is accepted, so the button declines the whole proposal. */
		declines: boolean;
		includedCount: number;
	} = $props();
</script>

{#if pendingAction === 'reject'}
	<Spinner data-icon="inline-start" />{m.change_review_rejecting()}
{:else if pendingAction !== null}
	<Spinner data-icon="inline-start" />{m.change_review_applying()}
{:else if declines}
	{m.change_review_decline_proposal()}
{:else}
	{m.change_review_apply_included({ count: includedCount })}
{/if}
