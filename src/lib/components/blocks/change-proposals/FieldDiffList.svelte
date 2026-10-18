<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { LabelledDiff } from './change_row_model.js';

	/** `label: old → new`; colour is a hint, the strikethrough, arrow and hidden labels carry meaning. */
	let { diffs }: { diffs: readonly LabelledDiff[] } = $props();
</script>

{#snippet removedValue(text: string, only: boolean)}
	<del class={['diff-old', only && 'only']}
		><span class="sr-only"
			>{only ? m.change_review_diff_removed() : m.change_review_diff_before()}
		</span>{text}</del
	>
{/snippet}

{#snippet addedValue(text: string, only: boolean)}
	<ins class={['diff-new', only && 'only']}
		><span class="sr-only"
			>{only ? m.change_review_diff_added() : m.change_review_diff_after()}
		</span>{text}</ins
	>
{/snippet}

<ul class="diff-list">
	{#each diffs as diff, index (index)}
		<li class="diff">
			<span class="diff-label">{diff.label}</span>
			<span class="diff-values">
				{#if diff.before !== null && diff.after !== null}
					{@render removedValue(diff.before, false)}
					<span class="diff-after">
						<span class="diff-arrow" aria-hidden="true">→</span>
						{@render addedValue(diff.after, false)}
					</span>
				{:else if diff.before !== null}
					{@render removedValue(diff.before, true)}
				{:else if diff.after !== null}
					{@render addedValue(diff.after, true)}
				{/if}
			</span>
		</li>
	{/each}
</ul>

<style>
	.diff-list {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.diff {
		display: grid;
		grid-template-columns: 76px minmax(0, 1fr);
		gap: var(--space-2);
		align-items: baseline;
	}

	.diff-label {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.diff-values,
	.diff-after {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) 6px;
		min-width: 0;
		font-size: var(--text-md);
	}

	.diff-old,
	.diff-new {
		padding: 1px 6px;
		border-radius: 5px;
		overflow-wrap: anywhere;
		box-decoration-break: clone;
	}

	.diff-old {
		background: color-mix(in oklab, var(--status-danger) 14%, var(--card));
		color: var(--status-danger-text);
		text-decoration: line-through;
		text-decoration-thickness: 1.5px;
	}

	.diff-new {
		background: color-mix(in oklab, var(--status-success) 14%, var(--card));
		color: var(--status-success-text);
		font-weight: 600;
		text-decoration: none;
	}

	.diff-new.only::before {
		content: '+ ';
		font-weight: 800;
	}

	.diff-arrow {
		color: var(--foreground);
		font-weight: 800;
	}

	@media (width < 640px) {
		.diff {
			grid-template-columns: 1fr;
			gap: 2px;
		}

		.diff-values {
			flex-direction: column;
			align-items: flex-start;
			gap: 3px;
		}
	}
</style>
