<script lang="ts">
	import DiffValues from './DiffValues.svelte';
	import type { LabelledDiff } from './change_row_model.js';

	/** `label: old → new` for changes the reviewer does not decide field by field. */
	let { diffs }: { diffs: readonly LabelledDiff[] } = $props();
</script>

<ul class="diff-list">
	{#each diffs as diff, index (index)}
		<li class="diff">
			<span class="diff-label">{diff.label}</span>
			<span class="diff-values"><DiffValues {diff} /></span>
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

	.diff-values {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) 6px;
		min-width: 0;
		font-size: var(--text-md);
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
