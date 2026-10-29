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
			<DiffValues {diff} />
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
		font-size: var(--text-md);
	}

	.diff-label {
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	@media (width < 640px) {
		.diff {
			--diff-values-direction: column;
			--diff-values-align: flex-start;
			--diff-values-gap: 3px;

			grid-template-columns: 1fr;
			gap: 2px;
		}
	}
</style>
