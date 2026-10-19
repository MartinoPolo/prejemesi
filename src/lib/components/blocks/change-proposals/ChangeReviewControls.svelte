<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';
	import {
		CHANGE_REVIEW_FILTER,
		isChangeReviewFilter,
		type ChangeReviewFilter,
	} from './change_review_rows.js';

	/** What starts preselected, and the row filter. */
	let {
		filter = $bindable(),
		filterCounts,
	}: {
		filter: ChangeReviewFilter;
		filterCounts: Record<ChangeReviewFilter, number>;
	} = $props();

	const filters = $derived([
		{ value: CHANGE_REVIEW_FILTER.all, label: m.change_review_filter_all() },
		{ value: CHANGE_REVIEW_FILTER.confirm, label: m.change_review_filter_confirm() },
		{ value: CHANGE_REVIEW_FILTER.conflicts, label: m.change_review_filter_conflicts() },
	]);
</script>

<div class="list-controls">
	<p class="master-note">{m.change_review_preselection_note()}</p>
	<div class="filters">
		<SegmentedToggle.Root
			value={filter}
			onValueChange={(value) => {
				if (isChangeReviewFilter(value)) {
					filter = value;
				}
			}}
			aria-label={m.change_review_filter_label()}
		>
			{#each filters as option (option.value)}
				<SegmentedToggle.Item
					value={option.value}
					data-testid="change-review-filter-{option.value}"
				>
					{option.label}<span class="filter-count">{filterCounts[option.value]}</span>
				</SegmentedToggle.Item>
			{/each}
		</SegmentedToggle.Root>
	</div>
</div>

<style>
	.list-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px var(--space-4);
		margin-top: var(--space-6);
	}

	.master-note {
		min-width: 0;
		color: var(--muted-foreground);
		font-size: var(--text-sm);
	}

	.filter-count {
		min-width: 18px;
		height: 18px;
		margin-left: 6px;
		padding: 0 5px;
		border-radius: 999px;
		background: color-mix(in oklab, var(--ink) 10%, transparent);
		font-size: var(--text-xs);
		font-weight: 800;
		line-height: 18px;
		text-align: center;
	}

	@media (width < 640px) {
		/* A wrapping column sizes its line to the widest item, so the filters would not shrink to the phone. */
		.list-controls {
			flex-flow: column nowrap;
			align-items: stretch;
		}

		/* The filters outgrow a phone, so they scroll sideways edge to edge like tabs. */
		.filters {
			margin: calc(-1 * var(--space-1)) calc(-1 * var(--page-gutter));
			padding: var(--space-1) var(--page-gutter);
			overflow-x: auto;
			scrollbar-width: none;
		}
	}
</style>
