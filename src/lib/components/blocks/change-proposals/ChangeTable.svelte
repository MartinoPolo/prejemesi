<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ChangeRow from './ChangeRow.svelte';
	import type { ChangeReviewActions, ReviewRowEntry } from './change_review_rows.js';

	/** Native table semantics so screen readers announce columns; the rows lay out as panels. */
	let {
		entries,
		caption,
		actions,
		showUnresolved,
	}: {
		entries: readonly ReviewRowEntry[];
		caption: string;
		actions: ChangeReviewActions | undefined;
		showUnresolved: boolean;
	} = $props();
</script>

<table class="change-table">
	<caption class="sr-only">{caption}</caption>
	<thead class="sr-only">
		<tr>
			<th scope="col">{m.change_review_column_kind()}</th>
			<th scope="col">{m.change_review_column_gift()}</th>
			<th scope="col">{m.change_review_column_changes()}</th>
			<th scope="col">{m.change_review_column_status()}</th>
			<th scope="col">{m.change_review_column_cards()}</th>
		</tr>
	</thead>
	<tbody>
		{#each entries as entry (entry.row.rowId)}
			<ChangeRow {entry} {actions} {showUnresolved} />
		{/each}
	</tbody>
</table>

<style>
	.change-table {
		display: block;
		width: 100%;
		border-collapse: separate;
	}

	.change-table > tbody {
		display: grid;
		gap: var(--space-3);
	}
</style>
