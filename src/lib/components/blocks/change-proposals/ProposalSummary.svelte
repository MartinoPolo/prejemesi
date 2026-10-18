<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import HourglassIcon from '@lucide/svelte/icons/hourglass';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import {
		CHANGE_KIND,
		CHANGE_PROPOSAL_STATE,
		type ChangeProposalView,
	} from '$lib/modules/change_proposals/types.js';
	import {
		changeReviewExpiryCopy,
		countCopy,
		formatChangeReviewDate,
		formatChangeReviewDateTime,
	} from '$lib/modules/change_proposals/change_review_copy.js';
	import ChangeKindTitle from './ChangeKindTitle.svelte';

	const CHANGE_COUNTS = {
		one: m.change_review_counts_one,
		few: m.change_review_counts_few,
		other: m.change_review_counts_other,
	};

	let { proposal, now }: { proposal: ChangeProposalView; now: Date } = $props();

	const kindCounts = $derived(
		Object.values(CHANGE_KIND)
			.map((kind) => ({ kind, count: proposal.kindCounts[kind] ?? 0 }))
			.filter((entry) => entry.count > 0),
	);
	const expiry = $derived.by(() => {
		if (proposal.state === CHANGE_PROPOSAL_STATE.expired) {
			return m.change_review_expired_on({ date: formatChangeReviewDate(proposal.expiresAt) });
		}
		return proposal.state === CHANGE_PROPOSAL_STATE.pending
			? changeReviewExpiryCopy(proposal.expiresAt, now)
			: null;
	});
</script>

<section class="summary" aria-label={m.change_review_summary_label()}>
	<span class="summary-icon" aria-hidden="true"><KeyRoundIcon /></span>
	<p class="summary-who">
		{m.change_review_submitted_by()} <strong>{proposal.submitterName}</strong>
		{m.change_review_submitted_via()}
		<strong>{m.change_review_token_name({ name: proposal.tokenName })}</strong>
		{#if proposal.tokenRevoked}
			<span class="revoked">({m.change_review_token_revoked()})</span>
		{/if}
	</p>
	<p class="summary-meta">
		<span>
			<ClockIcon aria-hidden="true" />
			{m.change_review_submitted_at({ date: formatChangeReviewDateTime(proposal.createdAt) })}
		</span>
		{#if expiry !== null}
			<span class="expires"><HourglassIcon aria-hidden="true" />{expiry}</span>
		{/if}
	</p>
	<div class="summary-counts">
		<strong>{countCopy(CHANGE_COUNTS, proposal.rowCount)}</strong>
		{#each kindCounts as entry (entry.kind)}
			<ChangeKindTitle kind={entry.kind} count={entry.count} />
		{/each}
	</div>
</section>

<style>
	.summary {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: var(--space-1) 14px;
		margin-top: var(--space-4);
		padding: 14px var(--space-4);
		border: 2px solid var(--ink);
		border-radius: var(--radius-panel);
		background: var(--card);
	}

	.summary-icon {
		display: grid;
		grid-row: span 3;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 2px solid var(--ink);
		border-radius: 10px;
		background: var(--tint);
		color: var(--ink);
	}

	.summary-icon :global(svg) {
		width: 20px;
		height: 20px;
	}

	.summary-who {
		font-size: var(--text-base);
		overflow-wrap: anywhere;
	}

	.revoked {
		color: var(--muted-foreground);
	}

	.summary-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		color: var(--muted-foreground);
		font-size: var(--text-md);
	}

	.summary-meta > span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.summary-meta :global(svg) {
		width: 14px;
		height: 14px;
	}

	.summary-meta > .expires {
		color: var(--foreground);
		font-weight: 600;
	}

	.summary-counts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-4);
		margin-top: 6px;
	}

	.summary-counts > strong {
		font-size: var(--text-md);
	}

	@media (width < 640px) {
		.summary {
			padding: var(--space-3);
		}

		.summary-icon {
			grid-row: auto;
			width: 32px;
			height: 32px;
		}

		.summary-meta,
		.summary-counts {
			grid-column: 1 / -1;
		}
	}
</style>
