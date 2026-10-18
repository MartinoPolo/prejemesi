<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import type { PendingChangeProposalSummary } from '$lib/modules/change_proposals/types.js';
	import {
		formatChangeReviewDate,
		pluralCopy,
		type PluralMessages,
	} from '$lib/modules/change_proposals/change_review_copy.js';

	const ITEM_TITLES: PluralMessages<{ count: number; token: string }> = {
		one: m.pending_changes_item_one,
		few: m.pending_changes_item_few,
		other: m.pending_changes_item_other,
	};

	/** Shown to the proposals' submitter only; the query returns nothing to anyone else. */
	let {
		wishlistShortId,
		proposals,
	}: {
		wishlistShortId: string;
		proposals: readonly PendingChangeProposalSummary[];
	} = $props();

	function reviewHref(proposalId: string): string {
		return localizeInternalHref(
			resolve('/(app)/w/[id]/changes/[proposalId]', { id: wishlistShortId, proposalId }),
		);
	}
</script>

<Alert.Root data-testid="pending-changes-banner">
	<KeyRoundIcon />
	<Alert.Title>{m.pending_changes_title({ count: proposals.length })}</Alert.Title>
	<Alert.Description>{m.pending_changes_description()}</Alert.Description>
	<ul class="proposals">
		{#each proposals as proposal (proposal.id)}
			<li class="proposal" data-testid="pending-changes-item">
				<span class="summary">
					<strong>
						{pluralCopy(ITEM_TITLES, {
							count: proposal.rowCount,
							token: proposal.tokenName,
						})}
					</strong>
					<span class="expiry">
						{m.pending_changes_expires({
							date: formatChangeReviewDate(proposal.expiresAt),
						})}
					</span>
				</span>
				<Button
					href={reviewHref(proposal.id)}
					size="sm"
					intent="secondary"
					data-testid="pending-changes-review"
				>
					{m.pending_changes_review()}
				</Button>
			</li>
		{/each}
	</ul>
</Alert.Root>

<style>
	.proposals {
		display: grid;
		grid-column: 2;
		gap: var(--space-2);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	.proposal {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-2);
	}

	.proposal strong {
		color: var(--foreground);
	}

	.expiry {
		color: var(--muted-foreground);
		white-space: nowrap;
	}
</style>
