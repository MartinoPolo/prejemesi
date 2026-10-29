<script lang="ts">
	import type { DecisionBarControls } from './chat_presentation.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import type { DecidingProposalRegistry } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
	import { getChangeProposal } from '$lib/modules/change_proposals/index.js';
	import type { StateRaw } from '$lib/reactivity/state.svelte.js';
	import ChatProposalCard from './ChatProposalCard.svelte';

	let {
		proposalId,
		wishlistShortId,
		rowContext,
		inBar,
		decisionBar,
		decidingProposals,
	}: {
		proposalId: string;
		wishlistShortId: string;
		rowContext: Omit<ChangeRowContext, 'submitterName' | 'kindTitle'>;
		inBar: boolean;
		decisionBar: StateRaw<DecisionBarControls | null>;
		decidingProposals: DecidingProposalRegistry;
	} = $props();

	const proposalQuery = $derived(getChangeProposal({ wishlistShortId, proposalId }));
	const proposal = $derived(proposalQuery.current);
</script>

{#if proposal !== undefined}
	{#key proposal.id}
		<ChatProposalCard {proposal} {rowContext} {inBar} {decisionBar} {decidingProposals} />
	{/key}
{:else if proposalQuery.error}
	<p class="error" role="alert">
		{m.chat_proposal_error()}
		<Button intent="secondary" size="sm" onclick={() => void proposalQuery.refresh()}>
			{m.chat_retry()}
		</Button>
	</p>
{:else}
	<div aria-busy="true">
		<span class="sr-only">{m.chat_proposal_loading()}</span>
		<Skeleton class="h-24 w-full" />
	</div>
{/if}

<style>
	.error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--status-danger-text);
		font-size: var(--text-md);
	}
</style>
