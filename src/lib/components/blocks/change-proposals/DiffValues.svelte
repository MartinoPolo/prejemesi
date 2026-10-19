<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { LabelledDiff } from './change_row_model.js';

	/** `old → new`; colour is a hint, the strikethrough, arrow and hidden labels carry meaning. */
	let { diff }: { diff: LabelledDiff } = $props();
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

<style>
	.diff-after {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) 6px;
		min-width: 0;
	}

	.diff-old,
	.diff-new {
		padding: var(--diff-value-pad, 1px 6px);
		border-radius: 5px;
		background: var(--diff-value-bg);
		overflow-wrap: anywhere;
		box-decoration-break: clone;
	}

	.diff-old {
		--diff-value-bg: var(
			--diff-old-bg,
			color-mix(in oklab, var(--status-danger) 14%, var(--card))
		);

		color: var(--status-danger-text);
		text-decoration: line-through;
		text-decoration-thickness: 1.5px;
	}

	.diff-new {
		--diff-value-bg: var(
			--diff-new-bg,
			color-mix(in oklab, var(--status-success) 14%, var(--card))
		);

		color: var(--diff-new-color, var(--status-success-text));
		font-weight: var(--diff-new-weight, 600);
		text-decoration: none;
	}

	.diff-new.only::before {
		content: '+ ';
		font-weight: 800;
	}

	.diff-arrow {
		color: var(--diff-arrow-color, var(--foreground));
		font-weight: 800;
	}
</style>
