<script lang="ts">
	import EmailAddress from './EmailAddress.svelte';
	import { CHANGE_KIND_PRESENTATION } from './change_review_presentation.js';
	import type { ReviewRowEntry } from './change_review_rows.js';

	/** The sensitive changes Apply is about to make, restated once more before they happen. */
	let { entries }: { entries: readonly ReviewRowEntry[] } = $props();
</script>

<ul class="confirm-list" data-testid="change-review-confirm-list">
	{#each entries as entry (entry.row.rowId)}
		{@const KindIcon = CHANGE_KIND_PRESENTATION[entry.row.kind].icon}
		<li>
			<span class="kind-mark" aria-hidden="true"><KindIcon /></span>
			<span>
				<strong>{entry.model.confirmTitle}</strong>
				{#if entry.model.confirmDetail.email !== null}
					<EmailAddress address={entry.model.confirmDetail.email} />
				{/if}
				{entry.model.confirmDetail.text}
			</span>
		</li>
	{/each}
</ul>

<style>
	.confirm-list {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.confirm-list > li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 10px;
		padding: 10px var(--space-3);
		border: 2px solid var(--ink);
		border-radius: var(--radius-badge);
		background: color-mix(in oklab, var(--accent-loud) 22%, var(--card));
		font-size: var(--text-md);
	}

	.confirm-list strong {
		display: block;
		font-size: var(--text-base);
	}

	.kind-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 2px solid var(--ink);
		border-radius: var(--radius-btn);
		background: var(--tint);
		color: var(--ink);
	}

	.kind-mark :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
