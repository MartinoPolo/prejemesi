<script lang="ts">
	import type { DecisionBarControls } from './chat_presentation.js';
	import * as m from '$lib/paraglide/messages.js';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import type { ChangeRowContext } from '$lib/components/blocks/change-proposals/change_row_model.js';
	import type { DecidingProposalRegistry } from '$lib/components/blocks/change-proposals/gift_live_preview.js';
	import {
		CHANGE_PROPOSAL_STATE,
		getChangeProposal,
		getPendingChangeProposals,
	} from '$lib/modules/change_proposals/index.js';
	import { refreshOnPageReturn } from '$lib/reactivity/page_return.js';
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
	const pending = $derived(proposal?.state === CHANGE_PROPOSAL_STATE.pending);

	/** Decided on its review page or in another tab, it shows its real state once the user is back. */
	$effect(() => {
		if (!pending) {
			return;
		}
		const query = proposalQuery;
		return refreshOnPageReturn(() => query.refresh());
	});

	/** An action found the proposal decided elsewhere: the card and the pending banner catch up. */
	function refreshOutdated() {
		void proposalQuery.refresh();
		void getPendingChangeProposals({ wishlistShortId }).refresh();
	}
</script>

{#if proposal !== undefined}
	{#key proposal.id}
		<ChatProposalCard
			{proposal}
			{rowContext}
			{inBar}
			{decisionBar}
			{decidingProposals}
			onoutdated={refreshOutdated}
		/>
	{/key}
{:else if proposalQuery.error}
	<Alert.Root tone="danger">
		<CircleAlertIcon aria-hidden="true" />
		<Alert.Description>{m.chat_proposal_error()}</Alert.Description>
		<Alert.Action>
			<Button intent="outline" size="sm" onclick={() => void proposalQuery.refresh()}>
				<RefreshCwIcon data-icon="inline-start" />{m.chat_retry()}
			</Button>
		</Alert.Action>
	</Alert.Root>
{:else}
	<div aria-busy="true">
		<span class="sr-only">{m.chat_proposal_loading()}</span>
		<Skeleton class="h-24 w-full" />
	</div>
{/if}
